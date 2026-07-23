#!/usr/bin/env python3
"""Instant manual-clock smoke of Sentinel's upstream relative/no-op/absolute evaluator."""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
from pathlib import Path


CORNER_ID = "sentinel-microhub-stars"


def init_payload(scenario: dict) -> dict:
    return {
        "environment": scenario["environment"],
        "event_timeline_end": scenario["event_timeline_end"],
        "eval_sql": scenario.get("eval_sql", ""),
        "condition_at": scenario.get("condition_at"),
        "speed_factor": 1.0,
        "events": scenario["events"],
        "start_page": scenario.get("start_page"),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", required=True)
    args = parser.parse_args()
    checkout = Path(args.checkout).resolve()
    os.chdir(checkout)
    sys.path.insert(0, str(checkout))

    build = subprocess.run(
        [sys.executable, "-m", "server.scripts.build_db"],
        cwd=checkout,
        check=False,
        text=True,
        capture_output=True,
    )
    if build.returncode != 0:
        sys.stderr.write(build.stdout)
        sys.stderr.write(build.stderr)
        raise RuntimeError(f"Sentinel database build failed with code {build.returncode}")

    from fastapi.testclient import TestClient
    from server.server import app

    relative_path = checkout / "scenarios" / "microhub" / "stars-relative-passive.json"
    noop_path = checkout / "scenarios" / "microhub" / "stars-noop.json"
    absolute_path = checkout / "scenarios" / "microhub" / "stars-absolute-passive.json"
    relative_scenario = json.loads(relative_path.read_text())
    noop_scenario = json.loads(noop_path.read_text())
    absolute_scenario = json.loads(absolute_path.read_text())

    with TestClient(app) as client:
        client.get("/close").raise_for_status()
        client.post("/init", json=init_payload(relative_scenario)).raise_for_status()
        contact_time = math.ceil(float(relative_scenario["condition_at"])) + 1
        client.get("/advance", params={"time": contact_time}).raise_for_status()
        client.get("/contact").raise_for_status()
        relative_result = client.post("/evaluate")
        relative_result.raise_for_status()
        relative_data = relative_result.json()

        client.get("/close").raise_for_status()
        client.post("/init", json=init_payload(noop_scenario)).raise_for_status()
        client.get("/advance", params={"time": float(noop_scenario["kill_at"])}).raise_for_status()
        noop_result = client.post("/evaluate")
        noop_result.raise_for_status()
        noop_data = noop_result.json()

        client.get("/close").raise_for_status()
        client.post("/init", json=init_payload(noop_scenario)).raise_for_status()
        client.get("/contact").raise_for_status()
        false_contact_result = client.post("/evaluate")
        false_contact_result.raise_for_status()
        false_contact_data = false_contact_result.json()

        client.get("/close").raise_for_status()
        client.post("/init", json=init_payload(absolute_scenario)).raise_for_status()
        absolute_contact_time = math.ceil(float(absolute_scenario["condition_at"])) + 1
        client.get("/advance", params={"time": absolute_contact_time}).raise_for_status()
        client.get("/contact").raise_for_status()
        absolute_result = client.post("/evaluate")
        absolute_result.raise_for_status()
        absolute_data = absolute_result.json()

        client.get("/close").raise_for_status()
        client.post("/init", json=init_payload(absolute_scenario)).raise_for_status()
        premature_contact_time = math.floor(float(absolute_scenario["condition_at"])) - 1
        client.get("/advance", params={"time": premature_contact_time}).raise_for_status()
        client.get("/contact").raise_for_status()
        premature_result = client.post("/evaluate")
        premature_result.raise_for_status()
        premature_data = premature_result.json()

    if relative_data.get("success") is not True:
        raise AssertionError("upstream relative scenario evaluator did not pass scripted late contact")
    if noop_data.get("success") is not True:
        raise AssertionError("upstream no-op evaluator did not pass absence of contact")
    if false_contact_data.get("success") is not False:
        raise AssertionError("upstream no-op evaluator did not reject false contact")
    if absolute_data.get("success") is not True:
        raise AssertionError("upstream absolute scenario evaluator did not pass scripted late contact")
    if premature_data.get("success") is not False:
        raise AssertionError("upstream absolute scenario evaluator did not reject premature contact")

    output = {
        "qualificationStatus": "qualified",
        "cornerId": CORNER_ID,
        "scenarioIds": [
            relative_scenario["id"],
            noop_scenario["id"],
            absolute_scenario["id"],
        ],
        "upstreamOracle": "server.server.evaluate via FastAPI TestClient",
        "manualClock": True,
        "relativeLateContactPassed": True,
        "noopNoContactPassed": True,
        "noopFalseContactRejected": True,
        "absoluteLateContactPassed": True,
        "absolutePrematureContactRejected": True,
        "browserAgentInvoked": False,
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
