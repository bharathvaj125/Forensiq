from sqlalchemy.orm import Session
from app.models.witness import Witness

def get_witness_by_id(db: Session, witness_id: int) -> Witness | None:
    """Retrieves a single witness record by WitnessMasterID."""
    return db.query(Witness).filter(Witness.WitnessMasterID == witness_id).first()

def get_witnesses_by_case(db: Session, case_id: int) -> list[Witness]:
    """Retrieves all witnesses associated with a specific CaseMasterID."""
    return db.query(Witness).filter(Witness.CaseMasterID == case_id).order_by(Witness.WitnessMasterID).all()

def create_witness(db: Session, witness_data: dict) -> Witness:
    """Creates a new Witness statement record."""
    db_witness = Witness(**witness_data)
    db.add(db_witness)
    db.commit()
    db.refresh(db_witness)
    return db_witness

def update_witness(db: Session, witness_db: Witness, witness_data: dict) -> Witness:
    """Updates fields on an existing Witness record."""
    for key, value in witness_data.items():
        setattr(witness_db, key, value)
    db.commit()
    db.refresh(witness_db)
    return witness_db

def delete_witness(db: Session, witness_id: int) -> bool:
    """Deletes a Witness record by WitnessMasterID."""
    db_witness = db.query(Witness).filter(Witness.WitnessMasterID == witness_id).first()
    if not db_witness:
        return False
    db.delete(db_witness)
    db.commit()
    return True
