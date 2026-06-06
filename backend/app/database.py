from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

# NullPool: no persistent connection pool — required for serverless (Vercel).
# Each request gets a fresh connection that is closed immediately after use.
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    poolclass=NullPool,
    # Supabase uses PgBouncer in transaction mode, which does not support
    # asyncpg's prepared statement cache. Disable it to avoid
    # DuplicatePreparedStatementError on reused PgBouncer connections.
    connect_args={"statement_cache_size": 0},
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
