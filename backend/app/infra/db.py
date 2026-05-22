from contextlib import contextmanager
from typing import Any, Optional

import psycopg
from psycopg.rows import dict_row

from backend.app.config.settings import get_settings


@contextmanager
def connection():
    database_url = get_settings().database_url
    if not database_url:
        raise RuntimeError("Missing Postgres env: DATABASE_URL")
    with psycopg.connect(database_url, row_factory=dict_row) as conn:
        yield conn


def rows(query: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            return list(cursor.fetchall())


def one(query: str, params: tuple[Any, ...] = ()) -> Optional[dict[str, Any]]:
    result = rows(query, params)
    return result[0] if result else None


def execute(query: str, params: tuple[Any, ...] = ()) -> None:
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(query, params)
