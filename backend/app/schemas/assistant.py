from pydantic import BaseModel, ConfigDict
from typing import List, Optional

class AssistantQueryRequest(BaseModel):
    query: str

class AssistantQueryResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    answer: str
    source_case_ids: List[int]
    model_version: str
    download_url: Optional[str] = None
