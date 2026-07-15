#!/usr/bin/env python3
"""License-safe MemoryAgentBench data-loader/scorer qualification."""

from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import sys
from pathlib import Path


CORNER_ID = "memoryagentbench-factconsolidation-6k"
ROW_IDS = ("factconsolidation_sh_6k", "factconsolidation_mh_6k")


def load_scorer(checkout: Path):
    path = checkout / "utils" / "eval_other_utils.py"
    spec = importlib.util.spec_from_file_location("pm_mab_upstream_scorer", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load pinned upstream scorer")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module, path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", required=True)
    parser.add_argument("--parquet", required=True)
    args = parser.parse_args()

    import pyarrow.parquet as parquet

    checkout = Path(args.checkout).resolve()
    parquet_path = Path(args.parquet).resolve()
    scorer, scorer_path = load_scorer(checkout)
    table = parquet.read_table(parquet_path)
    rows = table.to_pylist()
    by_source = {
        row.get("metadata", {}).get("source"): row
        for row in rows
        if isinstance(row.get("metadata"), dict)
    }
    summaries = []
    for row_id in ROW_IDS:
        row = by_source.get(row_id)
        if row is None:
            raise AssertionError(f"required row missing: {row_id}")
        questions = row.get("questions")
        answer_groups = row.get("answers")
        if not isinstance(questions, list) or not isinstance(answer_groups, list):
            raise AssertionError(f"invalid row schema: {row_id}")
        if len(questions) != len(answer_groups) or len(questions) == 0:
            raise AssertionError(f"question/answer cardinality mismatch: {row_id}")
        self_matches = 0
        synthetic_negative_matches = 0
        for answer_group in answer_groups:
            if not isinstance(answer_group, list) or not answer_group:
                raise AssertionError(f"empty answer group: {row_id}")
            prediction = str(answer_group[0])
            self_matches += int(
                scorer.drqa_metric_max_over_ground_truths(
                    scorer.substring_exact_match_score,
                    prediction,
                    answer_group,
                )
            )
            synthetic_negative_matches += int(
                scorer.drqa_metric_max_over_ground_truths(
                    scorer.substring_exact_match_score,
                    "pm synthetic intentionally absent value 7f19c2",
                    answer_group,
                )
            )
        summaries.append(
            {
                "rowId": row_id,
                "itemCount": len(questions),
                "selfMatchCount": self_matches,
                "syntheticNegativeMatchCount": synthetic_negative_matches,
            }
        )

    if not all(entry["selfMatchCount"] == entry["itemCount"] for entry in summaries):
        raise AssertionError("upstream scorer failed one or more self-match checks")
    output = {
        "qualificationStatus": "qualified",
        "cornerId": CORNER_ID,
        "upstreamLoader": "pyarrow.parquet.read_table",
        "upstreamScorer": "utils.eval_other_utils.substring_exact_match_score",
        "scorerFileSha256": hashlib.sha256(scorer_path.read_bytes()).hexdigest(),
        "parquetFileSha256": hashlib.sha256(parquet_path.read_bytes()).hexdigest(),
        "rows": summaries,
        "adapterAndOraclePlumbingOnly": True,
        "efficacyClaimed": False,
    }
    print(json.dumps(output, sort_keys=True, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"{type(error).__name__}: {error}", file=sys.stderr)
        raise SystemExit(1)
