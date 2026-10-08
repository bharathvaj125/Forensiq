"""Seniority of police ranks, used to decide who may appoint tasks to whom.

Ranks arrive as free text ("DGP - Director General of Police", "Sub-Inspector", "Circle Inspector"...), so each is
matched on whole words against the force's rank ladder, most specific pattern first. A rank that matches nothing
has no weight and can neither delegate nor outrank anyone."""

from __future__ import annotations

import re

# (weight, pattern) in the order they are tried: longer / more specific titles before the titles they contain.
RANK_LADDER: list[tuple[int, re.Pattern]] = [(weight, re.compile(pattern, re.IGNORECASE)) for weight, pattern in [
    (90, r"\badgp\b|additional director general"),
    (100, r"\bdgp\b|director general"),
    (70, r"\bdigp\b|deputy inspector general"),
    (80, r"\bigp\b|inspector general"),
    (65, r"sp \(sg\)|selection grade"),
    (55, r"addl\.? ?sp|additional superintendent"),
    (50, r"\basp\b|assistant superintendent"),
    (45, r"\bdysp\b|deputy superintendent"),
    (60, r"\bsp\b|superintendent"),
    (20, r"\basi\b|assistant sub[- ]?inspector"),
    (30, r"\bpsi\b|\bsi\b|sub[- ]?inspector"),
    (40, r"\bpi\b|\bci\b|circle inspector|inspector"),
    (10, r"\bhc\b|head constable"),
    (5, r"\bpc\b|constable"),
]]


def rank_weight(rank: str | None) -> int | None:
    """Higher is more senior; None when the text is not a recognised police rank."""
    text = (rank or "").replace("�", "-")
    for weight, pattern in RANK_LADDER:
        if pattern.search(text):
            return weight
    return None
