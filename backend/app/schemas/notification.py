from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    created_at: datetime
    is_read: bool = False
