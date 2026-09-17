from sqlalchemy.orm import Session
from app.models.user import User

def get_user_by_username(db: Session, username: str) -> User | None:
    """Retrieves a user record by their unique username (case-insensitive)."""
    return db.query(User).filter(User.Username.ilike(username)).first()

def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Retrieves a user record by their primary key UserID."""
    return db.query(User).filter(User.UserID == user_id).first()

def create_user(db: Session, username: str, password_hash: str, email: str, officer_id: int = None) -> User:
    """Creates and commits a new user record in the database."""
    db_user = User(
        Username=username,
        PasswordHash=password_hash,
        Email=email,
        OfficerID=officer_id,
        IsActive=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user
