import logging
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from app.api import auth, posts, accounts, jobs
from app.core.config import settings

logging.basicConfig(
    level=logging.INFO if settings.environment != "development" else logging.DEBUG,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown events."""
    logger.info("AutoPost backend starting up (environment: %s)", settings.environment)

    # Initialize Sentry if DSN is configured
    if settings.sentry_dsn:
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[
                StarletteIntegration(transaction_style="endpoint"),
                FastApiIntegration(transaction_style="endpoint"),
            ],
            traces_sample_rate=0.1,
            environment=settings.environment,
        )
        logger.info("Sentry initialized")

    yield

    logger.info("AutoPost backend shutting down")


app = FastAPI(
    title="AutoPost API",
    description="Social media scheduling platform API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow the frontend origin (and localhost for development)
origins = [
    settings.frontend_url,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(posts.router, prefix="/api")
app.include_router(accounts.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint for load balancers and deployment platforms."""
    return {"status": "ok", "environment": settings.environment}
