import re
from pydantic import BaseModel, model_validator

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def sanitize_text(value: str) -> str:
    """Trim, drop control characters and neutralise angle brackets so stored text can never form markup.
    Apostrophes, quotes and ampersands are kept as typed (the UI escapes on output), so FIR text is not
    stored as '&#x27;' and '&amp;'."""
    return _CONTROL_CHARS.sub("", value.strip()).replace("<", "&lt;").replace(">", "&gt;")


class SanitizedBaseModel(BaseModel):
    """Base schema that sanitises every incoming string value (see sanitize_text)."""
    @model_validator(mode="before")
    @classmethod
    def sanitize_string_inputs(cls, data: any) -> any:
        if isinstance(data, dict):
            return {key: sanitize_text(val) if isinstance(val, str) else val for key, val in data.items()}
        return data
