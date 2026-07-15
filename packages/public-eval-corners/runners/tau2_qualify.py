#!/usr/bin/env python3
"""Reference-action replay with an explicit mid-transition restart for tau2 task 32."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


CORNER_ID = "tau2-airline-32"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkout", required=True)
    args = parser.parse_args()
    checkout = Path(args.checkout).resolve()
    sys.path.insert(0, str(checkout / "src"))

    from tau2.data_model.message import AssistantMessage, ToolCall
    from tau2.domains.airline.environment import get_environment, get_tasks
    from tau2.evaluator.evaluator_env import EnvironmentEvaluator

    task = next(task for task in get_tasks(None) if task.id == "32")
    criteria = task.evaluation_criteria
    if criteria is None or criteria.actions is None:
        raise AssertionError("task 32 has no reference actions")

    environment = get_environment()
    trajectory = []
    update_occurrence = 0
    committed_hash_before_restart = None
    committed_hash_after_restart = None
    for index, action in enumerate(criteria.actions):
        tool_call = ToolCall(
            id=f"pm-reference-{index}",
            name=action.name,
            arguments=action.arguments,
            requestor=action.requestor,
        )
        tool_message = environment.get_response(tool_call)
        if tool_message.error:
            raise AssertionError(f"reference action failed at index {index}")
        trajectory.extend(
            [
                AssistantMessage(
                    role="assistant",
                    content=None,
                    tool_calls=[tool_call],
                ),
                tool_message,
            ]
        )
        if action.name == "update_reservation_flights":
            update_occurrence += 1
            if update_occurrence == 1:
                committed_hash_before_restart = environment.get_db_hash()
                committed_db = environment.tools.db.model_copy(deep=True)
                environment = get_environment(db=committed_db)
                committed_hash_after_restart = environment.get_db_hash()

    if update_occurrence != 2:
        raise AssertionError("task 32 no longer has exactly two flight-update transitions")
    if committed_hash_before_restart != committed_hash_after_restart:
        raise AssertionError("committed database hash changed across the injected restart")

    reward = EnvironmentEvaluator.calculate_reward(
        environment_constructor=get_environment,
        task=task,
        full_trajectory=trajectory,
    )
    db_check = reward.db_check
    if db_check is None or not db_check.db_match or reward.reward != 1.0:
        raise AssertionError("upstream EnvironmentEvaluator rejected reference replay")
    output = {
        "qualificationStatus": "qualified",
        "cornerId": CORNER_ID,
        "taskId": "airline:32",
        "referenceActionCount": len(criteria.actions),
        "flightUpdateTransitionCount": update_occurrence,
        "restartBoundary": {
            "afterFlightUpdateOccurrence": 1,
            "committedHashPreserved": True,
            "committedStateSha256": committed_hash_after_restart,
        },
        "upstreamOracle": {
            "component": "EnvironmentEvaluator.calculate_reward",
            "reward": reward.reward,
            "dbMatch": db_check.db_match,
            "dbReward": db_check.db_reward,
        },
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
