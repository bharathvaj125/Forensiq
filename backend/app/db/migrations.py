"""Lightweight column migrations.

Base.metadata.create_all() creates missing tables but never alters existing ones, so columns added
after the first deploy are added here (idempotent, works on PostgreSQL and SQLite)."""

import logging

from sqlalchemy import inspect, text

logger = logging.getLogger("ksp_backend")

NEW_COLUMNS = {
    "case_master": {"AIRiskLevel": "VARCHAR", "AIRiskModelVersion": "VARCHAR"},
    "court_cases": {"CaseMasterID": "BIGINT"},
}


def ensure_columns(engine) -> list[str]:
    added = []
    inspector = inspect(engine)
    for table, columns in NEW_COLUMNS.items():
        if not inspector.has_table(table):
            continue
        existing = {column["name"] for column in inspector.get_columns(table)}
        with engine.begin() as connection:
            for name, sql_type in columns.items():
                if name not in existing:
                    connection.execute(text(f'ALTER TABLE {table} ADD COLUMN "{name}" {sql_type}'))
                    added.append(f"{table}.{name}")
    if added:
        logger.info("Added columns: %s", ", ".join(added))
    return added
