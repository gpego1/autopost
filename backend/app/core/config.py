from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    database_url: str
    encrypt_key: str
    # Secret Vercel sends in Authorization header for cron requests.
    # Leave empty in development to skip the check.
    cron_secret: str = ""
    meta_app_id: str = ""
    meta_app_secret: str = ""
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""
    frontend_url: str = "http://localhost:5173"
    sentry_dsn: Optional[str] = None
    environment: str = "development"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
