"""
Oh-My-Guard! – Server Configuration (Pydantic Settings)
All values loaded from environment variables or .env file.
Secrets must NEVER be hard-coded here.
"""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=("/etc/Oh-My-Guard!/Oh-My-Guard!.env", "/etc/Oh-My-Guard!/db.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server
    aegis_host: str               = Field("0.0.0.0", alias="AEGIS_HOST")
    aegis_port: int               = Field(8443,       alias="AEGIS_PORT")
    aegis_tls_cert: str           = Field(...,        alias="AEGIS_TLS_CERT")
    aegis_tls_key: str            = Field(...,        alias="AEGIS_TLS_KEY")
    aegis_ca_cert: str            = Field(...,        alias="AEGIS_CA_CERT")
    aegis_ca_key: str             = Field(...,        alias="AEGIS_CA_KEY")
    aegis_master_key: str         = Field(...,        alias="AEGIS_MASTER_KEY")
    aegis_secret_key: str         = Field(...,        alias="AEGIS_SECRET_KEY")
    aegis_environment: str        = Field("production", alias="AEGIS_ENVIRONMENT")

    # Database
    database_url: str             = Field(..., alias="DATABASE_URL")

    # Redis
    redis_url: str                = Field("redis://localhost:6379/0", alias="REDIS_URL")

    # Logging
    aegis_log_level: str          = Field("INFO", alias="AEGIS_LOG_LEVEL")
    aegis_log_dir: str            = Field("/var/log/Oh-My-Guard!", alias="AEGIS_LOG_DIR")

    # Data directories
    aegis_data_dir: str           = Field("/var/lib/Oh-My-Guard!", alias="AEGIS_DATA_DIR")

    # Initial admin (consumed once at startup, then deleted from env)
    aegis_superadmin_user: str    = Field("superadmin", alias="AEGIS_SUPERADMIN_USER")
    aegis_superadmin_pass: str    = Field("",           alias="AEGIS_SUPERADMIN_PASS")

    # VPN defaults
    aegis_vpn_server: str         = Field("127.0.0.1", alias="AEGIS_VPN_SERVER")

    # JWT settings
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int   = 7

    # Notifications
    smtp_host: str | None         = Field(None, alias="SMTP_HOST")
    smtp_port: int                = Field(587,  alias="SMTP_PORT")
    smtp_user: str | None         = Field(None, alias="SMTP_USER")
    smtp_pass: str | None         = Field(None, alias="SMTP_PASS")
    smtp_from: str                = Field("Oh-My-Guard!@localhost", alias="SMTP_FROM")

    slack_webhook_url: str | None = Field(None, alias="SLACK_WEBHOOK_URL")
    teams_webhook_url: str | None = Field(None, alias="TEAMS_WEBHOOK_URL")


settings = Settings()
