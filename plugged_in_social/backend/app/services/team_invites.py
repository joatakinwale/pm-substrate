"""Team invite email — branded Resend send on top of a Supabase invite link.

Flow (see ``app/api/team.py``):
  1. Admin calls POST /team/invite
  2. Backend generates a Supabase invite action_link (suppresses Supabase's
     own email) and writes the User row pre-linked via ``auth_id``
  3. This module renders the branded HTML and queues the send through
     the email-sender Cloudflare Worker via
     ``queue_publisher.publish_email_notification``

Kept as its own module so the invite copy/style can evolve without
entangling with onboarding or dunning email templates.
"""
from html import escape as html_escape


# Brand-aligned inline CSS. Duplicated (not imported from onboarding.py)
# because team-invite voice is distinct — crisp and procedural rather
# than warm/client-facing — and private helpers shouldn't become a
# cross-module dependency by accident.
_STEVIE_GREEN = "#089140"
_EMAIL_FONT = (
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, "
    "'Helvetica Neue', Arial, sans-serif"
)


def _render_cta(label: str, url: str) -> str:
    return (
        f'<p style="margin:28px 0;">'
        f'<a href="{html_escape(url)}" '
        f'style="background:{_STEVIE_GREEN};color:#ffffff;'
        f"padding:14px 24px;text-decoration:none;border-radius:6px;"
        f"display:inline-block;font-weight:600;font-family:{_EMAIL_FONT};"
        f'font-size:15px;">{html_escape(label)}</a></p>'
    )


def _wrap(html_inner: str) -> str:
    return (
        f'<div style="font-family:{_EMAIL_FONT};color:#000000;'
        f'font-size:16px;line-height:1.55;max-width:560px;">'
        f"{html_inner}"
        f"</div>"
    )


def render_invite_email(
    *,
    full_name: str,
    org_name: str,
    inviter_name: str,
    role: str,
    action_link: str,
) -> tuple[str, str]:
    """Return ``(subject, html_body)`` for the team-invite email.

    ``action_link`` must be the Supabase-generated one-time invite URL.
    That link is tokenised and expires — NEVER embed passwords or secrets
    into the surrounding body copy.
    """
    subject = f"You&#x2019;re invited to join {html_escape(org_name)} on Stevie Social"
    # Copy intent: brisk, collaborator-to-collaborator. No "we're excited",
    # no filler. State who invited them, what they'll have access to, and
    # give them exactly one action.
    name = html_escape(full_name or "there")
    # The DB stores roles in code-flavor (``admin``, ``editor``, ``owner``,
    # ``viewer``, ``client``). Render them in human-flavor so the email
    # reads "as an Admin" rather than "as admin". The ``a/an`` choice is
    # role-specific and small enough to keep inline.
    role_label_map = {
        "owner": "the Owner",
        "admin": "an Admin",
        "editor": "an Editor",
        "viewer": "a Viewer",
        "client": "a Client",
    }
    role_phrase = role_label_map.get(
        role.strip().lower() if role else "",
        f"a {html_escape(role.replace('_', ' ').title())}",
    )
    body = _wrap(
        f"<p>Hi {name},</p>"
        f"<p><strong>{html_escape(inviter_name)}</strong> added you to "
        f"<strong>{html_escape(org_name)}</strong> on Stevie Social as "
        f"<strong>{role_phrase}</strong>.</p>"
        "<p>Accept the invite to set your password and get started. The "
        "link below is one-time and expires in 24 hours.</p>"
        + _render_cta("Accept invite", action_link)
        + "<p style=\"color:#555;font-size:13px;\">"
        "If you weren&#x2019;t expecting this, you can safely ignore this email."
        "</p>"
        "<p>&mdash; The Stevie Social Team</p>"
    )
    return subject, body


async def queue_invite_email(
    *,
    to_email: str,
    full_name: str,
    org_name: str,
    inviter_name: str,
    role: str,
    action_link: str,
    org_id: str,
) -> None:
    """Queue the branded invite email through the email-sender Worker.

    Worker handles Resend rate-limit + retries; we just emit the message.
    Fire-and-forget — failure is non-fatal for the invite flow (the User
    row still exists and the admin can re-send).

    ``org_id`` is required (no default) because the new queue contract
    needs it to scope per-tenant rate limiting and observability. Callers
    must pass the inviting user's org_id explicitly.
    """
    from app.services.queue_publisher import publish_email_notification

    subject, html_body = render_invite_email(
        full_name=full_name,
        org_name=org_name,
        inviter_name=inviter_name,
        role=role,
        action_link=action_link,
    )
    await publish_email_notification(
        org_id=org_id,
        to=to_email,
        subject=subject,
        html_body=html_body,
    )
