"""
Synchronous SQLAlchemy engine for sync code paths.

Used by the internal endpoints (``app/api/internal/*``) when they offload
sync work to a worker thread via ``asyncio.to_thread`` — for example the
WeasyPrint report renderer, the social publisher SDKs, and the automation
StepExecutor. The async engine + ``get_db_with_rls`` covers the FastAPI
request path.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.core.config import get_settings

settings = get_settings()

sync_engine = create_engine(
    settings.database_url_sync,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
)

SyncSessionLocal = sessionmaker(bind=sync_engine, class_=Session, expire_on_commit=False)
