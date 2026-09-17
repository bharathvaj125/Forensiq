"""
Alembic migration environment.

Purpose: wires Alembic's autogenerate to app.db.base.Base.metadata and
resolves the DB URL from app.core.config.settings (never hardcoded).
Used by: `alembic upgrade head` / `alembic revision --autogenerate`.

NOTE: Scaffold placeholder only. Standard Alembic env.py boilerplate
(target_metadata = Base.metadata, run_migrations_online/offline) to be
filled in during Milestone 0.
"""
