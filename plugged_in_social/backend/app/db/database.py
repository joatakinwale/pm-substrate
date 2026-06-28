"""Database engine, session factory, and FastAPI dependency with RLS support.

RLS Pattern (plain Postgres, no Supabase):
  On every request, FastAPI middleware sets three Postgres session variables:
    - app.current_org_id
    - app.current_user_id
    - app.current_user_role
  RLS policies read these via current_setting('app.current_org_id', true).
  This gives us per-request tenant isolation at the database level.
"""
from collections.abc import AsyncGenerator
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

# Async engine for FastAPI request handling
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@dataclass
class RequestContext:
    """Holds the authenticated user's context for a single request."""
    org_id: str
    user_id: str
    role: str


async def _set_rls_context(session: AsyncSession, ctx: RequestContext) -> None:
    """Set Postgres session variables so RLS policies can read them."""
    await session.execute(
        text("SELECT set_config('app.current_org_id', :org_id, true)"),
        {"org_id": ctx.org_id},
    )
    await session.execute(
        text("SELECT set_config('app.current_user_id', :user_id, true)"),
        {"user_id": ctx.user_id},
    )
    await session.execute(
        text("SELECT set_config('app.current_user_role', :role, true)"),
        {"role": ctx.role},
    )


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a DB session per request.

    NOTE: For unauthenticated routes (public pages, health checks),
    use this directly. RLS won't be set, so only tables without
    RLS or with service-bypass policies will be accessible.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_public() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency for UNAUTHENTICATED public endpoints.

    Used by endpoints that serve anonymous visitors and therefore have
    no JWT / no ``RequestContext`` to set RLS session variables with —
    e.g. the public form-submission endpoint that routes by form slug.

    Our RLS policies use the non-nullable form of ``current_setting``
    (``current_setting('app.current_org_id')::uuid``), so a session
    without those settings would raise on every query against an
    RLS-protected table. Setting ``row_security = off`` for this
    session is the minimum escape hatch that lets the public endpoint
    look up the resource it needs (by a globally-safe identifier such
    as a slug) without silently leaking data.

    SECURITY: only use this dependency on endpoints that are
    *intentionally* unauthenticated. Once the endpoint has determined
    the relevant ``org_id`` from the resource it looked up, any
    downstream writes must still be scoped to that ``org_id``
    explicitly.
    """
    async with AsyncSessionLocal() as session:
        try:
            # Disable RLS for this session — there is no auth context to
            # set. Scoped with LOCAL so it only lasts for this
            # transaction, not for the pooled connection.
            await session.execute(text("SET LOCAL row_security = off"))
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db_with_rls(ctx: RequestContext) -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields a DB session WITH RLS context.

    Usage in a route:
        @router.get("/leads")
        async def list_leads(
            db: AsyncSession = Depends(get_db_with_rls_dep),
        ):
            ...

    The actual FastAPI dependency (get_db_with_rls_dep) is created
    in the auth module where it extracts RequestContext from the JWT.
    """
    async with AsyncSessionLocal() as session:
        try:
            await _set_rls_context(session, ctx)
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
