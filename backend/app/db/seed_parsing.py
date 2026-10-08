"""Parsers for seed-CSV cell values.

The original loader used a single int() parser for every column, which silently turned
non-numeric identifiers ('CP00038', 'GNG0001'), booleans ('True') and genders ('M') into NULL.
"""

import re

# GenderID is an integer column; the CSVs carry M / F / T.
GENDER_CODES = {"M": 1, "F": 2, "T": 3}
GENDER_LABELS = {1: "Male", 2: "Female", 3: "Transgender"}


def _blank(val) -> bool:
    return val is None or str(val).strip() == "" or str(val).strip().lower() in ("nan", "none", "null")


def parse_int(val):
    if _blank(val):
        return None
    try:
        return int(float(str(val).strip()))
    except ValueError:
        return None


def parse_id_suffix(val):
    """'CP00038' -> 38, 'GNG0001' -> 1, '12' -> 12, '' -> None."""
    if _blank(val):
        return None
    digits = re.sub(r"\D", "", str(val))
    return int(digits) if digits else None


def parse_flag(val) -> int:
    """'True' / 'true' / '1' / 'yes' -> 1, everything else -> 0."""
    return 1 if str(val).strip().lower() in ("true", "1", "yes", "y") else 0


def parse_gender(val):
    if _blank(val):
        return None
    return GENDER_CODES.get(str(val).strip().upper()[:1])


def gender_label(code):
    return GENDER_LABELS.get(code)
