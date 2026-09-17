# database/schema/

**Purpose:** Read-only reference copy of the already-finalized relational
schema (District, PoliceStation, CrimeType, CrimeSubType, CaseMaster,
Accused, Victim, Officer, Vehicle, Evidence, Witness) per SAD Section 1
and Section 24. This is documentation, not the live migration source —
the live schema is owned by `backend/alembic/versions/`.

**Responsibility:** Keep the original finalized schema (ERD/SQL export)
visible to the whole team without risk of it being accidentally edited
as if it were a migration.

**Used by:** Backend developers writing SQLAlchemy models
(`backend/app/models/`), AI Engine developers reading training data shape.
