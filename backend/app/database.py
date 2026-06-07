import logging
import re

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

logger = logging.getLogger(__name__)


def _resolve_db_url(url: str) -> str:
    """
    Supabase routes its "direct" connection host (db.<ref>.supabase.co:5432)
    through PgBouncer in transaction mode internally, which conflicts with
    asyncpg prepared statements (DuplicatePreparedStatementError).

    The Session Pooler (aws-0-<region>.pooler.supabase.com:5432) uses
    PgBouncer session mode: each asyncpg connection gets a dedicated
    PostgreSQL backend and prepared statements are cleaned up on close.

    If DATABASE_URL already points to the pooler or a non-Supabase host,
    this function is a no-op.
    """
    match = re.match(
        r"^(postgresql\+asyncpg://)([^:@]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co:5432/(.+)$",
        url,
    )
    if not match:
        return url
    scheme, _user, password, project_ref, database = match.groups()
    pooler_url = (
        f"{scheme}postgres.{project_ref}:{password}"
        f"@aws-0-us-east-1.pooler.supabase.com:5432/{database}"
    )
    logger.info("Using Supabase Session Pooler (us-east-1) for asyncpg compatibility")
    return pooler_url


_db_url = _resolve_db_url(settings.database_url)

# NullPool: no persistent connection pool — required for serverless (Vercel).
# Each request gets a fresh connection that is closed immediately after use.
engine = create_async_engine(
    _db_url,
    echo=settings.environment == "development",
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "timeout": 15,
        "command_timeout": 30,
    },
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def create_tables() -> None:
    """Create all tables (used in development; production uses Alembic)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
