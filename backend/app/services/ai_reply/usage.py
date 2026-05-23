from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from backend.app.config.settings import get_settings
from backend.app.infra.db import connection
from backend.app.services.formatting import create_id, now_iso

from .constants import (
    DEFAULT_MAX_COMPLETION_TOKENS_PER_REPLY,
    DEFAULT_TOKEN_USAGE_TIMEZONE,
    TOKEN_RESERVATION_TTL_SECONDS,
)


@dataclass(frozen=True)
class TokenReservation:
    id: str
    usage_day: str
    prompt_estimate_tokens: int
    max_completion_tokens: int
    reserved_tokens: int


class DailyTokenLimitExceededError(RuntimeError):
    def __init__(
        self, daily_limit: int, used_tokens: int, usage_day: str, timezone_name: str
    ) -> None:
        super().__init__(
            "Daily token limit reached "
            f"for {usage_day} ({timezone_name}): {used_tokens}/{daily_limit}"
        )
        self.daily_limit = daily_limit
        self.used_tokens = used_tokens
        self.usage_day = usage_day
        self.timezone_name = timezone_name


def ensure_usage_tables() -> None:
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                create table if not exists ai_daily_token_usage (
                  usage_day date primary key,
                  prompt_tokens bigint not null default 0,
                  completion_tokens bigint not null default 0,
                  total_tokens bigint not null default 0,
                  request_count bigint not null default 0,
                  updated_at timestamptz not null default now()
                )
                """
            )
            cursor.execute(
                """
                create table if not exists ai_token_usage_reservations (
                  id text primary key,
                  usage_day date not null,
                  reserved_tokens bigint not null,
                  actual_total_tokens bigint,
                  status text not null,
                  created_at timestamptz not null default now(),
                  updated_at timestamptz not null default now(),
                  constraint ai_token_usage_reservations_status_check
                    check (status in ('active', 'completed', 'cancelled', 'expired'))
                )
                """
            )
            cursor.execute(
                """
                create index if not exists ai_token_usage_reservations_usage_day_idx
                on ai_token_usage_reservations (usage_day, status)
                """
            )


def _usage_timezone_name() -> str:
    configured = get_settings().ai_reply_token_usage_timezone.strip()
    if configured:
        return configured
    return DEFAULT_TOKEN_USAGE_TIMEZONE


def _usage_timezone() -> ZoneInfo:
    timezone_name = _usage_timezone_name()
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo(DEFAULT_TOKEN_USAGE_TIMEZONE)


def current_usage_day() -> str:
    return datetime.now(_usage_timezone()).date().isoformat()


def _estimate_message_tokens(message: dict[str, Any]) -> int:
    role = str(message.get("role", ""))
    content = str(message.get("content", ""))
    return max(1, len(role) + len(content) + 12)


def estimate_prompt_tokens(messages: list[dict[str, Any]]) -> int:
    return 16 + sum(_estimate_message_tokens(message) for message in messages)


def _reservation_expiry_cutoff() -> str:
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=TOKEN_RESERVATION_TTL_SECONDS)
    return cutoff.isoformat().replace("+00:00", "Z")


def _expire_stale_reservations(cursor: Any, usage_day: str) -> None:
    cursor.execute(
        """
        update ai_token_usage_reservations
        set status = 'expired', updated_at = %s
        where usage_day = %s and status = 'active' and updated_at < %s
        """,
        (now_iso(), usage_day, _reservation_expiry_cutoff()),
    )


def _usage_row(cursor: Any, usage_day: str) -> dict[str, int]:
    cursor.execute(
        """
        insert into ai_daily_token_usage (usage_day, updated_at)
        values (%s, %s)
        on conflict (usage_day) do nothing
        """,
        (usage_day, now_iso()),
    )
    cursor.execute(
        """
        select prompt_tokens, completion_tokens, total_tokens, request_count
        from ai_daily_token_usage
        where usage_day = %s
        for update
        """,
        (usage_day,),
    )
    row = cursor.fetchone()
    return {
        "prompt_tokens": int(row["prompt_tokens"]) if row else 0,
        "completion_tokens": int(row["completion_tokens"]) if row else 0,
        "total_tokens": int(row["total_tokens"]) if row else 0,
        "request_count": int(row["request_count"]) if row else 0,
    }


def _active_reserved_tokens(cursor: Any, usage_day: str) -> int:
    cursor.execute(
        """
        select coalesce(sum(reserved_tokens), 0) as active_reserved_tokens
        from ai_token_usage_reservations
        where usage_day = %s and status = 'active'
        """,
        (usage_day,),
    )
    row = cursor.fetchone()
    return int(row["active_reserved_tokens"]) if row else 0


def reserve_daily_token_budget(
    messages: list[dict[str, Any]], daily_limit: int
) -> Optional[TokenReservation]:
    if daily_limit <= 0:
        return None

    ensure_usage_tables()
    usage_day = current_usage_day()
    timezone_name = _usage_timezone_name()
    prompt_estimate_tokens = estimate_prompt_tokens(messages)

    with connection() as conn:
        with conn.cursor() as cursor:
            _expire_stale_reservations(cursor, usage_day)
            usage = _usage_row(cursor, usage_day)
            active_reserved_tokens = _active_reserved_tokens(cursor, usage_day)

            remaining_tokens = (
                daily_limit - usage["total_tokens"] - active_reserved_tokens
            )
            max_completion_tokens = min(
                DEFAULT_MAX_COMPLETION_TOKENS_PER_REPLY,
                remaining_tokens - prompt_estimate_tokens,
            )
            if max_completion_tokens < 1:
                raise DailyTokenLimitExceededError(
                    daily_limit,
                    daily_limit - max(remaining_tokens, 0),
                    usage_day,
                    timezone_name,
                )

            reservation = TokenReservation(
                id=create_id(),
                usage_day=usage_day,
                prompt_estimate_tokens=prompt_estimate_tokens,
                max_completion_tokens=max_completion_tokens,
                reserved_tokens=prompt_estimate_tokens + max_completion_tokens,
            )
            cursor.execute(
                """
                insert into ai_token_usage_reservations (
                  id, usage_day, reserved_tokens, status, created_at, updated_at
                )
                values (%s, %s, %s, 'active', %s, %s)
                """,
                (
                    reservation.id,
                    reservation.usage_day,
                    reservation.reserved_tokens,
                    now_iso(),
                    now_iso(),
                ),
            )
            return reservation


def release_token_reservation(reservation_id: str) -> None:
    ensure_usage_tables()
    with connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                update ai_token_usage_reservations
                set status = 'cancelled', updated_at = %s
                where id = %s and status = 'active'
                """,
                (now_iso(), reservation_id),
            )


def _usage_values(usage: dict[str, Any]) -> tuple[int, int, int]:
    prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
    completion_tokens = int(usage.get("completion_tokens", 0) or 0)
    total_tokens = int(
        usage.get("total_tokens", prompt_tokens + completion_tokens)
        or prompt_tokens + completion_tokens
    )
    return prompt_tokens, completion_tokens, total_tokens


def record_daily_token_usage(
    usage: dict[str, Any], reservation_id: Optional[str] = None
) -> None:
    ensure_usage_tables()
    prompt_tokens, completion_tokens, total_tokens = _usage_values(usage)
    timestamp = now_iso()

    with connection() as conn:
        with conn.cursor() as cursor:
            usage_day = current_usage_day()
            if reservation_id:
                _expire_stale_reservations(cursor, usage_day)
                cursor.execute(
                    """
                    select id, usage_day, status
                    from ai_token_usage_reservations
                    where id = %s
                    for update
                    """,
                    (reservation_id,),
                )
                reservation = cursor.fetchone()
                if reservation and reservation["status"] == "active":
                    usage_day = str(reservation["usage_day"])
                    _usage_row(cursor, usage_day)
                    cursor.execute(
                        """
                        update ai_daily_token_usage
                        set prompt_tokens = prompt_tokens + %s,
                            completion_tokens = completion_tokens + %s,
                            total_tokens = total_tokens + %s,
                            request_count = request_count + 1,
                            updated_at = %s
                        where usage_day = %s
                        """,
                        (
                            prompt_tokens,
                            completion_tokens,
                            total_tokens,
                            timestamp,
                            usage_day,
                        ),
                    )
                    cursor.execute(
                        """
                        update ai_token_usage_reservations
                        set status = 'completed',
                            actual_total_tokens = %s,
                            updated_at = %s
                        where id = %s
                        """,
                        (total_tokens, timestamp, reservation_id),
                    )
                    return

            _usage_row(cursor, usage_day)
            cursor.execute(
                """
                update ai_daily_token_usage
                set prompt_tokens = prompt_tokens + %s,
                    completion_tokens = completion_tokens + %s,
                    total_tokens = total_tokens + %s,
                    request_count = request_count + 1,
                    updated_at = %s
                where usage_day = %s
                """,
                (prompt_tokens, completion_tokens, total_tokens, timestamp, usage_day),
            )


def get_today_token_usage_snapshot(daily_limit: int) -> dict[str, Any]:
    ensure_usage_tables()
    usage_day = current_usage_day()
    timezone_name = _usage_timezone_name()

    with connection() as conn:
        with conn.cursor() as cursor:
            _expire_stale_reservations(cursor, usage_day)
            usage = _usage_row(cursor, usage_day)
            active_reserved_tokens = _active_reserved_tokens(cursor, usage_day)

    remaining_tokens: Optional[int] = None
    limit_reached = False
    if daily_limit > 0:
        remaining_tokens = max(
            daily_limit - usage["total_tokens"] - active_reserved_tokens, 0
        )
        limit_reached = remaining_tokens == 0

    return {
        "usageDay": usage_day,
        "timezone": timezone_name,
        "promptTokens": usage["prompt_tokens"],
        "completionTokens": usage["completion_tokens"],
        "totalTokens": usage["total_tokens"],
        "requestCount": usage["request_count"],
        "activeReservedTokens": active_reserved_tokens,
        "remainingTokens": remaining_tokens,
        "limitReached": limit_reached,
    }
