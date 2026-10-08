"""Set-based bulk UPDATE helper.

Per-row UPDATEs against a remote database cost one network round trip each; this issues one
UPDATE ... FROM (VALUES ...) per page on PostgreSQL and falls back to the ORM elsewhere.
"""

from sqlalchemy.orm import Session


def bulk_update(db: Session, model, key: str, key_type: str, column_types: dict[str, str], rows: list[dict]) -> None:
    """rows: [{key: ..., col: ...}, ...]; column_types: {"col": "int" | "text" | "float8" | "timestamptz" ...}."""
    if not rows:
        return
    if db.get_bind().dialect.name != "postgresql":
        for start in range(0, len(rows), 1000):
            db.bulk_update_mappings(model, rows[start:start + 1000])
        db.commit()
        return

    from psycopg2.extras import execute_values

    table = model.__tablename__
    columns = [key, *column_types]
    set_clause = ", ".join(f'"{col}" = v."{col}"' for col in column_types)
    value_columns = ", ".join(f'"{col}"' for col in columns)
    template = "(" + ", ".join(
        [f"%s::{key_type}"] + [f"%s::{sql_type}" for sql_type in column_types.values()]
    ) + ")"
    sql = f'UPDATE {table} AS t SET {set_clause} FROM (VALUES %s) AS v({value_columns}) WHERE t."{key}" = v."{key}"'
    values = [tuple(row[col] for col in columns) for row in rows]
    cursor = db.connection().connection.cursor()
    try:
        execute_values(cursor, sql, values, template=template, page_size=1000)
    finally:
        cursor.close()
    db.commit()
