"""A small in-process TTL cache for expensive, read-mostly computations (reference lookups, the case frame, hotspots).

Every dashboard / predictive / map request used to reload and re-analyse all cases from the remote database; this keeps
the first call honest and makes the repeats instant. Entries expire on their own, and anything that changes case data
calls clear() so users never see stale counts after registering or updating an FIR."""

from __future__ import annotations

import threading
import time
from typing import Any, Callable

_store: dict[Any, tuple[float, Any]] = {}
_lock = threading.Lock()
MAX_ENTRIES = 256


def get_or_compute(key: Any, ttl_seconds: float, factory: Callable[[], Any]) -> Any:
    now = time.time()
    with _lock:
        hit = _store.get(key)
        if hit and hit[0] > now:
            return hit[1]
    value = factory()  # computed outside the lock so one slow computation does not block unrelated requests
    with _lock:
        if len(_store) >= MAX_ENTRIES:
            for stale in [k for k, (expires, _) in _store.items() if expires <= now] or [next(iter(_store))]:
                _store.pop(stale, None)
        _store[key] = (now + ttl_seconds, value)
    return value


def clear() -> None:
    with _lock:
        _store.clear()
