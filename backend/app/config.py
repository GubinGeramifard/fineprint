"""Application settings, loaded from environment / .env."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    cohere_api_key: str
    database_url: str = ""
    redis_url: str = ""
    allowed_origins: str = "http://localhost:3000"

    embed_model: str = "embed-multilingual-v3.0"
    embed_dim: int = 1024
    rerank_model: str = "rerank-multilingual-v3.0"
    chat_model: str = "command-r-08-2024"

    chunk_size: int = 450
    chunk_overlap: int = 90

    db_path: str = "data/docuchat.db"


settings = Settings()
