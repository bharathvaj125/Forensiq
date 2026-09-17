import contextvars

# ContextVar storing the current authenticated user's ID for database-wide auditing
current_user_id = contextvars.ContextVar("current_user_id", default=None)
