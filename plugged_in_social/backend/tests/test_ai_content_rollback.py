"""Regression tests for the AI content endpoints' rollback behaviour.

The earlier fix attempted to mark the row as ``status='failed'`` inside
the except handler before raising HTTPException, but
``get_db_with_rls_dep`` rolls back on any exception — so the failed
status update was discarded silently and the row stayed ``queued``.
That recreated the exact "stuck queued row" failure mode the fail-loud
path was meant to prevent.

These tests don't spin up a real DB — they pin the *implementation*:
the QueueNotConfiguredError handlers must NOT call ``await db.flush()``
or set ``status='failed'`` before raising. They must just raise.
"""
from __future__ import annotations

import inspect

from app.api import ai_content as ai_content_module


def _source(fn) -> str:
    return inspect.getsource(fn)


def test_generate_content_does_not_set_failed_before_raising():
    """Bug regression: the except block for QueueNotConfiguredError
    must not attempt a doomed write."""
    src = _source(ai_content_module.generate_content)
    except_block = src.split("except QueueNotConfiguredError", 1)[1]
    # Slice down to the next ``return`` or function end — keeps the
    # assertion focused on the handler body.
    until_raise = except_block.split("raise HTTPException", 1)[0]
    assert "status = \"failed\"" not in until_raise
    assert "status = 'failed'" not in until_raise
    assert "await db.flush()" not in until_raise
    assert "await db.commit()" not in until_raise


def test_retry_content_request_does_not_set_failed_before_raising():
    """Same regression on the retry endpoint."""
    src = _source(ai_content_module.retry_content_request)
    # The retry handler legitimately sets status='queued' BEFORE the
    # publish attempt — that's the pre-publish state reset. We only
    # care that the EXCEPT handler doesn't try to overwrite to 'failed'.
    except_block = src.split("except QueueNotConfiguredError", 1)[1]
    until_raise = except_block.split("raise HTTPException", 1)[0]
    assert "status = \"failed\"" not in until_raise
    assert "status = 'failed'" not in until_raise
    assert "await db.flush()" not in until_raise
    assert "await db.commit()" not in until_raise


def test_generate_content_handler_raises_503_with_actionable_message():
    """The 503 message must point the operator at the env var to set."""
    src = _source(ai_content_module.generate_content)
    except_block = src.split("except QueueNotConfiguredError", 1)[1]
    raise_chunk = except_block.split("raise HTTPException", 1)[1]
    assert "503" in raise_chunk
    assert "QUEUE_PRODUCER_URL" in raise_chunk
