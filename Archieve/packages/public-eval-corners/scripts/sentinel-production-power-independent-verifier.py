#!/usr/bin/env python3
"""Independent stdlib replay of the Sentinel v2 power-calculation artifact."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import multiprocessing
import struct
import sys
from pathlib import Path
from typing import Any

TASKS = 19
REPEATS = 3
MATERIAL_LIFT_PPM = 100_000
PLANNING_LIFT_PPM = 350_000
PPM = 1_000_000
U32 = 1 << 32
U64 = 1 << 64
BOOTSTRAP_DRAWS = 10_000
BOOTSTRAP_LOWER_INDEX = 499


class Xoshiro128StarStar:
    def __init__(self, digest: bytes) -> None:
        if len(digest) != 32:
            raise ValueError("trial digest must have 32 bytes")
        self.state = list(struct.unpack(">IIII", digest[:16]))
        if not any(self.state):
            self.state[0] = 0x9E3779B9

    @staticmethod
    def _rotl(value: int, bits: int) -> int:
        return ((value << bits) | (value >> (32 - bits))) & 0xFFFFFFFF

    def next_u32(self) -> int:
        s0, s1, s2, s3 = self.state
        result = (self._rotl((s1 * 5) & 0xFFFFFFFF, 7) * 9) & 0xFFFFFFFF
        temporary = (s1 << 9) & 0xFFFFFFFF
        s2 = (s2 ^ s0) & 0xFFFFFFFF
        s3 = (s3 ^ s1) & 0xFFFFFFFF
        s1 = (s1 ^ s2) & 0xFFFFFFFF
        s0 = (s0 ^ s3) & 0xFFFFFFFF
        s2 = (s2 ^ temporary) & 0xFFFFFFFF
        s3 = self._rotl(s3, 11)
        self.state = [s0, s1, s2, s3]
        return result


def threshold(rate_ppm: int) -> int:
    if not isinstance(rate_ppm, int) or not 0 <= rate_ppm <= PPM:
        raise ValueError("rate is not integer ppm")
    return rate_ppm * U32 // PPM


def trial_prng(seed: str, cell_id: str, trial: int) -> Xoshiro128StarStar:
    digest = hashlib.sha256(
        seed.encode("utf-8") + b"\0" + cell_id.encode("utf-8") +
        b"\0" + trial.to_bytes(8, "big")
    ).digest()
    return Xoshiro128StarStar(digest)


def arm_counts(prng: Xoshiro128StarStar, rate_ppm: int, rho_ppm: int) -> list[int]:
    rate = threshold(rate_ppm)
    shared = threshold(rho_ppm)
    output: list[int] = []
    for _task in range(TASKS):
        if prng.next_u32() < shared:
            output.append(REPEATS if prng.next_u32() < rate else 0)
        else:
            output.append(sum(prng.next_u32() < rate for _repeat in range(REPEATS)))
    return output


def sign_flip_pvalue(differences: list[int]) -> tuple[int, int]:
    distribution = [1]
    offset = 0
    nonzero = 0
    observed = sum(differences)
    for difference in differences:
        magnitude = abs(difference)
        if magnitude == 0:
            continue
        following = [0] * (len(distribution) + 2 * magnitude)
        for index, count in enumerate(distribution):
            following[index] += count
            following[index + 2 * magnitude] += count
        distribution = following
        offset += magnitude
        nonzero += 1
    numerator = sum(
        count for index, count in enumerate(distribution)
        if index - offset >= observed
    )
    return numerator, 1 << nonzero


def holm(native: tuple[int, int], sham: tuple[int, int]) -> bool:
    ordered = [native, sham] if native[0] * sham[1] <= sham[0] * native[1] else [sham, native]
    return ordered[0][0] * 40 <= ordered[0][1] and ordered[1][0] * 20 <= ordered[1][1]


def bootstrap_indices(seed: str) -> list[int]:
    accepted_limit = U64 // TASKS * TASKS
    output: list[int] = []
    counter = 0
    while len(output) < BOOTSTRAP_DRAWS * TASKS:
        candidate = int.from_bytes(hashlib.sha256(
            seed.encode("utf-8") + b"\0" + counter.to_bytes(8, "big")
        ).digest()[:8], "big")
        counter += 1
        if candidate < accepted_limit:
            output.append(candidate % TASKS)
    return output


def bootstrap_positive(
    substrate: list[int], native: list[int], sham: list[int], indices: list[int]
) -> bool:
    nonpositive = 0
    offset = 0
    for _draw in range(BOOTSTRAP_DRAWS):
        substrate_native = 0
        substrate_sham = 0
        for _selection in range(TASKS):
            task = indices[offset]
            offset += 1
            substrate_native += substrate[task] - native[task]
            substrate_sham += substrate[task] - sham[task]
        if substrate_native <= 0 or substrate_sham <= 0:
            nonpositive += 1
            if nonpositive > BOOTSTRAP_LOWER_INDEX:
                return False
    return True


def decision(substrate: list[int], native: list[int], sham: list[int], indices: list[int]) -> tuple[bool, bool, bool, bool]:
    minimum = math.ceil(MATERIAL_LIFT_PPM * TASKS * REPEATS / PPM)
    point = sum(substrate) - sum(native) >= minimum and sum(substrate) - sum(sham) >= minimum
    native_p = sign_flip_pvalue([s - n for s, n in zip(substrate, native)])
    sham_p = sign_flip_pvalue([s - h for s, h in zip(substrate, sham)])
    holm_pass = holm(native_p, sham_p)
    bootstrap_pass = bootstrap_positive(substrate, native, sham, indices)
    return point, holm_pass, bootstrap_pass, point and holm_pass and bootstrap_pass


def log_choose(n: int, k: int) -> float:
    smaller = min(k, n - k)
    return sum(math.log(n - smaller + index) - math.log(index) for index in range(1, smaller + 1))


def binomial_upper_tail(n: int, k: int, p: float) -> float:
    if k <= 0:
        return 1.0
    if k > n or p == 0:
        return 0.0
    if p == 1:
        return 1.0
    term = math.exp(log_choose(n, k) + k * math.log(p) + (n - k) * math.log1p(-p))
    total = term
    for successes in range(k, n):
        term *= ((n - successes) / (successes + 1)) * (p / (1 - p))
        total += term
    return min(1.0, total)


def clopper_pearson(successes: int, trials: int, alpha: float) -> float:
    if successes == 0:
        return 0.0
    low = 0.0
    high = successes / trials
    for _iteration in range(120):
        middle = (low + high) / 2
        if binomial_upper_tail(trials, successes, middle) >= alpha:
            high = middle
        else:
            low = middle
    return max(0.0, low - 1e-12)


def replay_cell(artifact: dict[str, Any], expected: dict[str, Any], indices: list[int]) -> list[str]:
    issues: list[str] = []
    baseline = expected["baselineRatePpm"]
    rho = expected["repeatIntraclassCorrelationPpm"]
    substrate_rate = baseline + PLANNING_LIFT_PPM
    counts = {"point": 0, "holm": 0, "bootstrap": 0, "full": 0}
    for trial in range(expected["trials"]):
        prng = trial_prng(artifact["simulation"]["seed"], expected["cellId"], trial)
        native = arm_counts(prng, baseline, rho)
        sham = arm_counts(prng, baseline, rho)
        substrate = arm_counts(prng, substrate_rate, rho)
        point, holm_pass, bootstrap_pass, full = decision(substrate, native, sham, indices)
        counts["point"] += point
        counts["holm"] += holm_pass
        counts["bootstrap"] += bootstrap_pass
        counts["full"] += full
    mappings = {
        "pointLiftGatePasses": counts["point"],
        "bothHolmRejectionsPasses": counts["holm"],
        "bootstrapPositiveLowerBoundPasses": counts["bootstrap"],
        "fullDeclaredRulePasses": counts["full"],
    }
    for key, value in mappings.items():
        if expected.get(key) != value:
            issues.append(f"{expected['cellId']}: {key} expected {expected.get(key)} replayed {value}")
    lower = clopper_pearson(
        counts["full"], expected["trials"], artifact["simulation"]["perCellTailAlpha"]
    )
    if abs(lower - expected["simultaneousClopperPearsonLowerBound"]) > 2e-12:
        issues.append(f"{expected['cellId']}: Clopper-Pearson lower bound differs")
    if expected.get("targetMetByConservativeLowerBound") != (lower >= 0.8):
        issues.append(f"{expected['cellId']}: conservative target decision differs")
    if abs(expected.get("estimatedPower", -1) - counts["full"] / expected["trials"]) > 1e-15:
        issues.append(f"{expected['cellId']}: estimated power differs from replay count")
    return issues


_WORKER_ARTIFACT: dict[str, Any] | None = None
_WORKER_INDICES: list[int] | None = None


def _initialize_worker(artifact: dict[str, Any]) -> None:
    global _WORKER_ARTIFACT, _WORKER_INDICES
    _WORKER_ARTIFACT = artifact
    _WORKER_INDICES = bootstrap_indices(artifact["simulation"]["bootstrapSeed"])


def _replay_worker(result: dict[str, Any]) -> list[str]:
    if _WORKER_ARTIFACT is None or _WORKER_INDICES is None:
        raise RuntimeError("independent replay worker was not initialized")
    return replay_cell(_WORKER_ARTIFACT, result, _WORKER_INDICES)


def verify(path: Path, workers: int) -> dict[str, Any]:
    artifact_bytes = path.read_bytes()
    artifact = json.loads(artifact_bytes.decode("utf-8"))
    issues: list[str] = []
    canonical_body = dict(artifact)
    declared_audit_hash = canonical_body.pop("auditSha256", None)
    replayed_audit_hash = hashlib.sha256(json.dumps(
        canonical_body, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")).hexdigest()
    if declared_audit_hash != replayed_audit_hash:
        issues.append("canonical audit hash does not match artifact claims")
    if artifact.get("schemaVersion") != "pm.public-eval-corners.sentinel-production-power-redesign.v2":
        issues.append("wrong artifact schema")
    results = artifact.get("results")
    if not isinstance(results, list):
        issues.append("results are missing")
        results = []
    design = artifact.get("design", {})
    simulation = artifact.get("simulation", {})
    baselines = design.get("baselineGridPpm", [])
    correlations = design.get("repeatIntraclassCorrelationSuitePpm", [])
    expected_cells = len(baselines) * len(correlations)
    expected_ids = {
        f"baseline-{baseline:07d}-rho-{rho:07d}"
        for rho in correlations for baseline in baselines
    }
    observed_ids: set[str] = set()
    for result in results:
        expected_id = (
            f"baseline-{result.get('baselineRatePpm', -1):07d}-"
            f"rho-{result.get('repeatIntraclassCorrelationPpm', -1):07d}"
        )
        if result.get("cellId") != expected_id or expected_id not in expected_ids:
            issues.append(f"noncanonical or out-of-grid cell {result.get('cellId')}")
        if result.get("cellId") in observed_ids:
            issues.append(f"duplicate cell {result.get('cellId')}")
        observed_ids.add(result.get("cellId"))
        if result.get("substrateRatePpm") != result.get("baselineRatePpm", -PLANNING_LIFT_PPM) + PLANNING_LIFT_PPM:
            issues.append(f"false substrate planning rate in {result.get('cellId')}")
        if result.get("trials") != simulation.get("trialsPerCell"):
            issues.append(f"false trial count in {result.get('cellId')}")
    if observed_ids != expected_ids:
        issues.append("cells do not exactly cover the declared Cartesian grid")
    if design.get("independentTaskCount") != TASKS or design.get("repeatsPerTask") != REPEATS:
        issues.append("task or repeat count differs from the frozen procedure")
    if sorted(set(baselines)) != baselines or sorted(set(correlations)) != correlations:
        issues.append("assumption grids are not sorted and unique")
    if 0 not in correlations or PPM not in correlations:
        issues.append("dependence suite omits independence or perfect dependence")
    expected_alpha = (1.0 - 0.99) / expected_cells if expected_cells else math.nan
    if simulation.get("cellsInConfidenceFamily") != expected_cells or not math.isclose(
        simulation.get("perCellTailAlpha", math.nan), expected_alpha, rel_tol=0, abs_tol=1e-18
    ):
        issues.append("Bonferroni confidence family is false")
    if artifact.get("procedureSha256") != "c8938b9a73cd2ea7a04f45df54692cba3266605c33486b06eb387b9f77fbc6a7":
        issues.append("calculation procedure hash is not frozen v2")
    boundary = artifact.get("estimandBoundary", {})
    if boundary.get("minimumObservedMaterialLiftOverEachControl") != 0.1 or boundary.get("planningAlternativeTrueLift") != 0.35:
        issues.append("material threshold and planning alternative are not separated as frozen")
    if workers == 1:
        indices = bootstrap_indices(artifact["simulation"]["bootstrapSeed"])
        for result in results:
            issues.extend(replay_cell(artifact, result, indices))
    elif results:
        with multiprocessing.Pool(
            processes=min(workers, len(results)),
            initializer=_initialize_worker,
            initargs=(artifact,),
        ) as pool:
            for replay_issues in pool.map(_replay_worker, results, chunksize=1):
                issues.extend(replay_issues)
    if len(results) != expected_cells:
        issues.append("result count does not cover the Cartesian grid")
    if results:
        independent = [
            result["simultaneousClopperPearsonLowerBound"] for result in results
            if result["repeatIntraclassCorrelationPpm"] == 0
        ]
        listed_zero_and_point_one = [
            result["simultaneousClopperPearsonLowerBound"] for result in results
            if result["repeatIntraclassCorrelationPpm"] in (0, 100_000)
        ]
        conclusions = artifact.get("conclusions", {})
        expected_conclusions = {
            "minimumIndependentRepeatLowerBound": min(independent),
            "independentRepeatTargetMetAcrossBaselineGrid": min(independent) >= 0.8,
            "minimumListedZeroAndPointOneIccLowerBound": min(listed_zero_and_point_one),
            "listedZeroAndPointOneIccTargetMetAcrossBaselineGrid": min(listed_zero_and_point_one) >= 0.8,
            "minimumAllSensitivityLowerBound": min(
                result["simultaneousClopperPearsonLowerBound"] for result in results
            ),
        }
        expected_conclusions["targetMetAcrossAllDependenceSensitivityCells"] = (
            expected_conclusions["minimumAllSensitivityLowerBound"] >= 0.8
        )
        expected_conclusions["planningAlternativeCanPowerConditional19x3Design"] = (
            expected_conclusions["independentRepeatTargetMetAcrossBaselineGrid"]
        )
        for key, value in expected_conclusions.items():
            if conclusions.get(key) != value:
                issues.append(f"derived conclusion is false: {key}")
        if conclusions.get("poweredExecutionEligibleFromThisArtifactAlone") is not False or conclusions.get("repeatDependenceBoundEstablishedByEvidence") is not False:
            issues.append("planning artifact attempts to self-authorize execution")
        if conclusions.get("smallestHonestRedesign") != (
            "separate-0.10-materiality-from-0.35-planning-alternative-and-retain-19x3-only-"
            "after-independent-evidence-bounds-repeat-dependence-and-the-calculation-covers-"
            "the-accepted-range-otherwise-add-independent-relative-tasks-and-repower"
        ):
            issues.append("smallest honest redesign was changed")
    return {
        "schemaVersion": "pm.public-eval-corners.sentinel-power-independent-verification.v1",
        "implementation": "python-stdlib-independent-replay-v1",
        "pythonVersion": sys.version.split()[0],
        "artifactAuditSha256": artifact.get("auditSha256"),
        "artifactFileSha256": hashlib.sha256(artifact_bytes).hexdigest(),
        "procedureSha256": artifact.get("procedureSha256"),
        "verifierSourceSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "cellsReplayed": len(results),
        "workers": min(workers, max(1, len(results))),
        "valid": not issues,
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("artifact", type=Path)
    parser.add_argument("--workers", type=int, default=1)
    arguments = parser.parse_args()
    if arguments.workers < 1 or arguments.workers > 64:
        parser.error("--workers must be from 1 through 64")
    receipt = verify(arguments.artifact, arguments.workers)
    print(json.dumps(receipt, sort_keys=True, separators=(",", ":")))
    return 0 if receipt["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
