"""Public form contract tests.

The embed URL copied from the admin points anonymous visitors at
``/form/{slug}``, which in turn reads ``/api/forms/public/{slug}``.
That response must be enough to render and submit a form, without leaking
notification recipients or automation internals.
"""
from __future__ import annotations

from app.schemas.email_campaigns import PublicFormResponse


def test_public_form_response_fields_are_safelisted():
    expected = {
        "name",
        "slug",
        "description",
        "schema_json",
        "theme_json",
        "success_message",
        "redirect_url",
    }
    assert set(PublicFormResponse.model_fields.keys()) == expected


def test_public_form_response_excludes_internal_fields():
    assert "notify_emails" not in PublicFormResponse.model_fields
    assert "automation_id" not in PublicFormResponse.model_fields
    assert "org_id" not in PublicFormResponse.model_fields
    assert "submission_count" not in PublicFormResponse.model_fields
