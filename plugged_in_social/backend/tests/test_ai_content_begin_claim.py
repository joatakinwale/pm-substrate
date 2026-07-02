from __future__ import annotations

import inspect

from app.api.internal import ai as internal_ai_module


def test_begin_ai_request_claims_row_before_building_prompt():
    src = inspect.getsource(internal_ai_module.begin_ai_request)

    claim_pos = src.index('req.status = "generating"')
    flush_pos = src.index("await db.flush()")
    prompt_pos = src.index("user_prompt = _build_user_prompt(req)")

    assert claim_pos < flush_pos < prompt_pos


def test_begin_ai_request_returns_after_rls_generator_finishes():
    src = inspect.getsource(internal_ai_module.begin_ai_request)
    loop_body = src.split("async for db in get_db_with_rls(ctx):", 1)[1].split(
        "# Defensive", 1
    )[0]

    assert "response = AIBeginResponse(" in loop_body
    assert "return AIBeginResponse(" not in loop_body
