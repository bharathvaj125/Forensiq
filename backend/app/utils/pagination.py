"""Shared pagination helpers for consistent Phase 3 list-response envelopes."""

from math import ceil
from typing import Generic, Sequence, TypeVar

T = TypeVar("T")


def paginate(items: Sequence[T], total: int, page: int, page_size: int, applied_scope: str) -> dict:
    """Return the standard API envelope used by all paginated resources."""
    return {
        "data": list(items),
        "meta": {
            "total": total,
            "page": page,
            "pageSize": page_size,
            "totalPages": ceil(total / page_size) if total else 0,
        },
        "appliedScope": applied_scope,
    }
