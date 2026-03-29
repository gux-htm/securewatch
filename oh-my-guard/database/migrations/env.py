"""Alembic environment configuration for async SQLAlchemy."""
import asyncio
import os
import logging
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import all models so Alembic can detect them
import sys; sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))
from database.models import Base

config = context.config
config.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"])

if config.config_file_name is not None:
    fileConfig(config.config_file_name)
    root_logger = logging.getLogger()
    if root_logger.level < logging.INFO:
        root_logger.setLevel(logging.INFO)
    # Enforce secure logging format and file permissions
    secure_formatter = logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s')
    for handler in root_logger.handlers:
        handler.setFormatter(secure_formatter)
        if isinstance(handler, logging.FileHandler):
            try:
                os.chmod(handler.baseFilename, 0o600)
            except OSError:
                pass

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True,
                      dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
