from __future__ import annotations

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    api_host: str = Field("0.0.0.0", env="API_HOST")
    api_port: int = Field(8000, env="API_PORT")
    log_level: str = Field("info", env="API_LOG_LEVEL")
    app_version: str = Field("0.1.0", env="APP_VERSION")

    postgres_user: str = Field("mockadmin", env="POSTGRES_USER")
    postgres_password: str = Field("mockpassword", env="POSTGRES_PASSWORD")
    postgres_db: str = Field("mockapi", env="POSTGRES_DB")
    postgres_host: str = Field("postgres", env="POSTGRES_HOST")
    postgres_port: int = Field(5432, env="POSTGRES_PORT")

    admin_username: str = Field("admin", env="ADMIN_USERNAME")
    admin_password: str = Field("admin123", env="ADMIN_PASSWORD")

    enable_openapi: bool = Field(True, env="ENABLE_OPENAPI")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
