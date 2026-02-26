from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[1] / ".env"),
        extra="ignore",
    )

    supabase_url: str
    supabase_service_role_key: str
    supabase_anon_key: str | None = None
    supabase_jwt_secret: str | None = None

    llm_provider: str = "openai_compatible"  # openai_compatible | gemini
    llm_base_url: str = "https://api.openai.com/v1"
    llm_api_key: str
    llm_model: str = "gpt-4o-mini"

    # Optional: if using Gemini, you can set GEMINI_MODEL to override llm_model
    gemini_model: str | None = None

    cors_allow_origins: str = "*"

    # MongoDB settings
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "financial_copilot"

    # JWT settings for custom auth
    jwt_secret: str = "your-super-secret-key-change-this-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days

    # Google OAuth settings
    google_client_id: str = "1035751746820-88qdnhupc7uq3l4ich1h81vne4d3vr1v.apps.googleusercontent.com"


settings = Settings()
