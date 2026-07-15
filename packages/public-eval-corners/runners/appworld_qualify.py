#!/usr/bin/env python3
"""Local-only AppWorld protected-bundle qualification with a license-safe summary."""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path


CORNER_ID = "appworld-22cc237_2"
TASK_ID = "22cc237_2"


def run_setup(command: list[str], checkout: Path, environment: dict[str, str]) -> str:
    result = subprocess.run(
        command,
        cwd=checkout,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    combined = result.stdout + result.stderr
    if result.returncode != 0:
        raise RuntimeError(f"AppWorld local setup command failed with code {result.returncode}")
    return combined


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", required=True)
    parser.add_argument("--data-root", required=True)
    parser.add_argument("--allow-local-unpack", action="store_true")
    args = parser.parse_args()
    if not args.allow_local_unpack:
        raise PermissionError("explicit local protected-bundle opt-in is required")

    checkout = Path(args.checkout).resolve()
    data_root = Path(args.data_root).resolve()
    data_root.mkdir(parents=True, exist_ok=True)
    environment = dict(os.environ)
    environment["APPWORLD_ROOT"] = str(data_root)
    environment["PYTHONPATH"] = str(checkout / "src")

    setup_log = ""
    if not (checkout / "src" / "appworld" / "apps" / "venmo").exists():
        setup_log += run_setup(
            [sys.executable, "-m", "appworld.cli", "install", "--repo"],
            checkout,
            environment,
        )
    if not (data_root / "data" / "datasets" / "train.txt").exists():
        setup_log += run_setup(
            [
                sys.executable,
                "-m",
                "appworld.cli",
                "download",
                "data",
                "--mode",
                "minimal",
                "--root",
                str(data_root),
            ],
            checkout,
            environment,
        )

    os.environ.update(environment)
    sys.path.insert(0, str(checkout / "src"))
    captured_path = data_root / "appworld-qualification-captured.log"
    with captured_path.open("w") as capture:
        capture.write(setup_log)
        capture.flush()
        with contextlib.redirect_stdout(capture), contextlib.redirect_stderr(capture):
            from appworld import AppWorld, load_task_ids

            if TASK_ID not in load_task_ids("train"):
                raise AssertionError("selected task is not present in the public train split")
            with AppWorld(
                task_id=TASK_ID,
                experiment_name="pm_public_eval_qualification",
                ground_truth_mode="full",
            ) as world:
                ground_truth = world.task.ground_truth
                if ground_truth is None:
                    raise AssertionError("train ground truth was not loaded")
                code = ground_truth.compiled_solution_code + "\nsolution(apis, requester)"
                execution_output = world.execute(code)
                tracker = world.evaluate()
                test_count = tracker.num_tests
                pass_count = tracker.pass_count
                fail_count = tracker.fail_count
                success = tracker.success

    captured_log = captured_path.read_bytes()
    if not success:
        raise AssertionError("upstream AppWorld evaluator rejected its compiled train solution")

    output = {
        "qualificationStatus": "qualified",
        "cornerId": CORNER_ID,
        "taskId": TASK_ID,
        "publicTrainSplit": True,
        "dataVersion": "0.2.0",
        "upstreamOracle": "AppWorld.evaluate/TestTracker",
        "testCount": test_count,
        "passCount": pass_count,
        "failCount": fail_count,
        "success": success,
        "executionOutputSha256": hashlib.sha256(execution_output.encode()).hexdigest(),
        "capturedLocalLogSha256": hashlib.sha256(captured_log).hexdigest(),
        "protectedMaterialStoredOutsideGit": True,
        "duplicateProjectionWeakness": {
            "status": "known-unresolved",
            "diagnosticNonGating": True,
            "upstreamOracleRemainsAuthoritative": True,
        },
        "adapterAndOraclePlumbingOnly": True,
        "efficacyClaimed": False,
    }
    print(json.dumps(output, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except PermissionError as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(2)
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
