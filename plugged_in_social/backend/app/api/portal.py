"""Client Portal API — magic-link auth + client views.

Two route groups:
  1. /api/portal/auth — token validation, session management (no auth required)
  2. /api/portal/* — client-facing data (requires portal session)

Admin-side endpoints (invite generation) are in the projects router.
"""
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import os

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import Integer, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

# FE-25: name of the HttpOnly cookie that carries the portal session
# token in the post-migration world. Kept in a constant so portal_deps
# and this module agree on the name without each importing each other
# in circular-risky ways.
PORTAL_COOKIE_NAME = "stevie_portal_session"
# Session lifetime matches PortalSession.expires_at (7 days).
PORTAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7
# Secure flag: off in dev (http://localhost), on everywhere else.
# APP_ENV=dev is the single signal we use — if unset, default to secure
# (fail-safe: a stray production request without the env var still gets
# the Secure attribute).
_APP_ENV = os.getenv("APP_ENV", "production").lower()
PORTAL_COOKIE_SECURE = _APP_ENV != "dev"

from app.auth.deps import get_current_user, get_db_with_rls_dep
from app.auth.portal_deps import get_portal_db, get_portal_session
from app.db.database import get_db
from app.models.invoice import Invoice
from app.models.portal import PortalSession, PortalToken
from app.models.project import CLIENT_VISIBLE_STEP, Project, Task, TaskComment
from app.models.proposal import Proposal
from app.schemas.portal import (
    PortalApprovalRequest,
    PortalAuthRequest,
    PortalAuthResponse,
    PortalCommentCreate,
    PortalInviteRequest,
    PortalInviteResponse,
    PortalInvoiceView,
    PortalProjectSummary,
    PortalProposalView,
    PortalTaskView,
)
from app.schemas.projects import CommentResponse

router = APIRouter(prefix="/portal", tags=["portal"])


# ═══ ADMIN: Generate portal invite ═════════════════════════

@router.post("/invite", response_model=PortalInviteResponse, status_code=201)
async def create_portal_invite(
    body: PortalInviteRequest,
    db: AsyncSession = Depends(get_db_with_rls_dep),
    current_user: dict = Depends(get_current_user),
):
    """Generate a magic-link token and (optionally) send it to the client.

    Called by agency team members from the project detail page.
    The returned token should be embedded in a URL like:
      {FRONTEND_URL}/portal/auth?token=xxx
    — caller constructs the URL using ``settings.frontend_url`` (see
    ``app.core.config``) so it points at the right host per environment.
    """
    org_id = uuid.UUID(current_user["org_id"])
    token_str = secrets.token_urlsafe(48)

    portal_token = PortalToken(
        org_id=org_id,
        token=token_str,
        client_email=body.client_email,
        client_name=body.client_name,
        project_id=body.project_id,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        created_by=uuid.UUID(current_user["sub"]),
    )
    db.add(portal_token)
    await db.flush()
    await db.refresh(portal_token)
    return PortalInviteResponse.model_validate(portal_token)


# ═══ PUBLIC: Token validation + session creation ════════════

@router.post("/auth", response_model=PortalAuthResponse)
async def authenticate_portal_token(
    body: PortalAuthRequest,
    response: Response,
):
    """Validate a magic-link token and create a portal session.

    This is the entry point for clients clicking their magic link.

    FE-25: we now set the session token as an HttpOnly, Secure, SameSite=Lax
    cookie in addition to returning it in the JSON body. This lets the
    frontend migrate from localStorage (vulnerable to XSS) to cookie-based
    auth without a breaking API change — older clients that ignore the
    cookie still authenticate via the Bearer path, and portal_deps accepts
    either source until we drop the bearer path entirely. SameSite=Lax so
    the cookie rides cross-origin navigations (magic link click) but not
    cross-site form POSTs; the API and frontend may be on separate
    subdomains (api.stevie.social vs stevie.social) which is same-site.
    """
    async for db in get_db():
        result = await db.execute(
            select(PortalToken).where(
                PortalToken.token == body.token,
                PortalToken.is_used == False,
            )
        )
        token = result.scalar_one_or_none()

        if not token:
            raise HTTPException(status_code=401, detail="Invalid or already-used token")

        now = datetime.now(timezone.utc)
        if token.expires_at < now:
            raise HTTPException(status_code=401, detail="Token has expired")

        # Mark token as used
        token.is_used = True
        token.used_at = now

        # Create portal session (7-day expiry)
        session_token = secrets.token_urlsafe(48)
        session = PortalSession(
            org_id=token.org_id,
            session_token=session_token,
            client_email=token.client_email,
            client_name=token.client_name,
            project_id=token.project_id,
            expires_at=now + timedelta(days=7),
            last_active_at=now,
            token_id=token.id,
        )
        db.add(session)
        await db.commit()

        # FE-25: set HttpOnly cookie. httponly=True blocks document.cookie
        # reads so XSS payloads can't exfiltrate the token. secure=True on
        # production so it's only sent over HTTPS. samesite="lax" is the
        # browser default and sufficient here (portal API is not a CSRF
        # target since all mutating endpoints still require proof of
        # session, which the cookie IS — but see FE-25 follow-up note in
        # portal-api.ts about CSRF tokens for state-changing requests).
        response.set_cookie(
            key=PORTAL_COOKIE_NAME,
            value=session_token,
            max_age=PORTAL_COOKIE_MAX_AGE,
            httponly=True,
            secure=PORTAL_COOKIE_SECURE,
            samesite="lax",
            path="/",
        )

        return PortalAuthResponse(
            session_token=session_token,
            client_email=token.client_email,
            client_name=token.client_name,
            org_id=token.org_id,
            project_id=token.project_id,
            expires_at=session.expires_at,
        )


@router.post("/auth/logout")
async def portal_logout(
    response: Response,
    portal_client: dict = Depends(get_portal_session),
):
    """Invalidate the current portal session.

    FE-25: also clears the portal session cookie. delete_cookie() emits
    Set-Cookie with Max-Age=0 which the browser interprets as immediate
    expiry — note that path+samesite+secure must match the set_cookie
    call or the browser treats it as a different cookie and leaves the
    original in place (hence the explicit flags below).
    """
    async for db in get_db():
        result = await db.execute(
            select(PortalSession).where(
                PortalSession.id == uuid.UUID(portal_client["session_id"])
            )
        )
        session = result.scalar_one_or_none()
        if session:
            session.is_active = False
            await db.commit()
    response.delete_cookie(
        key=PORTAL_COOKIE_NAME,
        path="/",
        secure=PORTAL_COOKIE_SECURE,
        samesite="lax",
    )
    return {"status": "logged_out"}


# ═══ CLIENT: Project views ══════════════════════════════════

@router.get("/projects", response_model=list[PortalProjectSummary])
async def list_client_projects(
    db: AsyncSession = Depends(get_portal_db),
    portal_client: dict = Depends(get_portal_session),
):
    """List projects visible to this client.

    Filters by client_email match on the project.
    If the portal session is scoped to a specific project, only that project is returned.

    Performance (MED-5)
    -------------------
    The original implementation ran one ``SELECT count(*)`` per project —
    classic N+1. A portal user with 50 projects paid 51 round-trips. This
    version executes a single grouped aggregate via ``LEFT OUTER JOIN`` so
    the total round-trip count is always 1, regardless of project count.
    Projects with zero pending approvals still appear (``COALESCE(..., 0)``).
    """
    # Build a per-project "pending approvals" counter as a grouped
    # aggregate. The CASE expression emits 1 when the joined task row
    # qualifies as a pending approval, 0 otherwise, so SUM() gives us the
    # count. ``COUNT(*) FILTER (WHERE ...)`` would be cleaner but isn't
    # portable across dialects; a CASE-sum works on Postgres + sqlite.
    pending_case = case(
        (
            (Task.workflow_step == CLIENT_VISIBLE_STEP)
            & (Task.client_visible == True)  # noqa: E712
            & (Task.client_approved == False),  # noqa: E712
            1,
        ),
        else_=0,
    )
    pending_expr = func.coalesce(
        func.sum(func.cast(pending_case, Integer)),
        0,
    ).label("pending_approvals")

    query = (
        select(Project, pending_expr)
        .outerjoin(Task, Task.project_id == Project.id)
        .where(
            Project.client_email == portal_client["client_email"],
            # PM-1: belt-and-braces filter. Internal projects should never
            # have a client_email set, but adding the explicit type guard
            # means a misconfigured row (accidental client_email on an
            # internal project) still can't leak through the portal.
            Project.project_type == "client",
        )
        .group_by(Project.id)
        .order_by(Project.created_at.desc())
    )

    if portal_client.get("project_id"):
        query = query.where(Project.id == uuid.UUID(portal_client["project_id"]))

    result = await db.execute(query)
    rows = result.all()

    return [
        PortalProjectSummary(
            id=p.id,
            name=p.name,
            status=p.status,
            compound_phase=p.compound_phase,
            start_date=p.start_date,
            target_date=p.target_date,
            pending_approvals=int(pending or 0),
        )
        for p, pending in rows
    ]


@router.get("/projects/{project_id}/tasks", response_model=list[PortalTaskView])
async def list_client_tasks(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_portal_db),
    portal_client: dict = Depends(get_portal_session),
):
    """List Step 9 tasks visible to this client for a specific project.

    Only returns tasks where:
      - workflow_step == 9 (Client Approval)
      - client_visible == True
    """
    # Verify client has access to this project. If the portal session is
    # scoped to a specific project, that scope must also match.
    proj_query = select(Project).where(
        Project.id == project_id,
        Project.client_email == portal_client["client_email"],
        # PM-1: never serve tasks from an internal-type project to the
        # portal, even if client_email somehow matches.
        Project.project_type == "client",
    )
    if portal_client.get("project_id"):
        proj_query = proj_query.where(
            Project.id == uuid.UUID(portal_client["project_id"])
        )
    proj_result = await db.execute(proj_query)
    if not proj_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(Task).where(
            Task.project_id == project_id,
            Task.workflow_step == CLIENT_VISIBLE_STEP,
            Task.client_visible == True,
        ).order_by(Task.position)
    )
    tasks = result.scalars().all()
    return [PortalTaskView.model_validate(t) for t in tasks]


async def _load_client_visible_task(
    db: AsyncSession,
    task_id: uuid.UUID,
    portal_client: dict,
) -> Task:
    """Load a Step 9 task, enforcing parent-project ownership in one query.

    A Portal session is scoped by ``client_email`` (and optionally a single
    ``project_id``). We must not let a holder of any portal session read or
    mutate a task whose parent project they don't own. Joining to
    ``Project`` in the same query eliminates the enumeration-by-UUID risk
    that separate lookups created.
    """
    query = (
        select(Task)
        .join(Project, Project.id == Task.project_id)
        .where(
            Task.id == task_id,
            Task.workflow_step == CLIENT_VISIBLE_STEP,
            Task.client_visible == True,
            Project.client_email == portal_client["client_email"],
            # PM-1: never match a task whose parent is an internal-type
            # project, even if every other predicate lines up.
            Project.project_type == "client",
        )
    )
    if portal_client.get("project_id"):
        query = query.where(Project.id == uuid.UUID(portal_client["project_id"]))

    result = await db.execute(query)
    task = result.scalar_one_or_none()
    if not task:
        # Do not distinguish between "task doesn't exist" and "task isn't
        # yours" — both collapse to 404 to avoid enumeration.
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@router.post("/tasks/{task_id}/approve", response_model=PortalTaskView)
async def approve_or_revise_task(
    task_id: uuid.UUID,
    body: PortalApprovalRequest,
    db: AsyncSession = Depends(get_portal_db),
    portal_client: dict = Depends(get_portal_session),
):
    """Client approves or requests revisions on a Step 9 task."""
    task = await _load_client_visible_task(db, task_id, portal_client)

    task.client_approved = body.approved
    task.client_feedback = body.feedback
    task.version += 1
    await db.flush()
    await db.refresh(task)
    return PortalTaskView.model_validate(task)


@router.get("/tasks/{task_id}/comments", response_model=list[CommentResponse])
async def list_task_comments(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_portal_db),
    portal_client: dict = Depends(get_portal_session),
):
    """List comments on a task visible to the client."""
    # Enforce parent-project ownership before returning any comments.
    await _load_client_visible_task(db, task_id, portal_client)

    result = await db.execute(
        select(TaskComment).where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at.asc())
    )
    return [CommentResponse.model_validate(c) for c in result.scalars().all()]


@router.post("/tasks/{task_id}/comments", response_model=CommentResponse, status_code=201)
async def add_client_comment(
    task_id: uuid.UUID,
    body: PortalCommentCreate,
    db: AsyncSession = Depends(get_portal_db),
    portal_client: dict = Depends(get_portal_session),
):
    """Client adds a comment to a Step 9 task."""
    # Enforce parent-project ownership before allowing any write.
    await _load_client_visible_task(db, task_id, portal_client)

    comment = TaskComment(
        task_id=task_id,
        author_name=portal_client.get("client_name", portal_client["client_email"]),
        content=body.content,
        is_client_comment=True,
    )
    db.add(comment)
    await db.flush()
    await db.refresh(comment)
    return CommentResponse.model_validate(comment)


# ═══ CLIENT: Invoices ═══════════════════════════════════════

@router.get("/invoices", response_model=list[PortalInvoiceView])
async def list_client_invoices(
    db: AsyncSession = Depends(get_portal_db),
    portal_client: dict = Depends(get_portal_session),
):
    """List invoices for the client (matched by email)."""
    result = await db.execute(
        select(Invoice).where(
            Invoice.client_email == portal_client["client_email"]
        ).order_by(Invoice.created_at.desc())
    )
    invoices = result.scalars().all()
    return [PortalInvoiceView.model_validate(i) for i in invoices]


# ═══ CLIENT: Proposals ══════════════════════════════════════

@router.get("/proposals", response_model=list[PortalProposalView])
async def list_client_proposals(
    db: AsyncSession = Depends(get_portal_db),
    portal_client: dict = Depends(get_portal_session),
):
    """List proposals sent to this client."""
    result = await db.execute(
        select(Proposal).where(
            Proposal.client_email == portal_client["client_email"],
            Proposal.status.in_(["sent", "viewed", "signed"]),
        ).order_by(Proposal.created_at.desc())
    )
    proposals = result.scalars().all()
    return [PortalProposalView.model_validate(p) for p in proposals]


# ═══ CLIENT: Session info ══════════════════════════════════

@router.get("/me")
async def portal_me(
    portal_client: dict = Depends(get_portal_session),
):
    """Return current portal session info."""
    return {
        "client_email": portal_client["client_email"],
        "client_name": portal_client.get("client_name"),
        "org_id": portal_client["org_id"],
        "project_id": portal_client.get("project_id"),
    }
