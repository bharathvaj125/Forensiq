import html
from pydantic import BaseModel, model_validator

class SanitizedBaseModel(BaseModel):
    """
    Base Pydantic schema that automatically trims whitespace and escapes HTML entities
    on all incoming string values to protect against Cross-Site Scripting (XSS) injections.
    """
    @model_validator(mode="before")
    @classmethod
    def sanitize_string_inputs(cls, data: any) -> any:
        if isinstance(data, dict):
            for key, val in data.items():
                if isinstance(val, str):
                    data[key] = html.escape(val.strip())
        return data
