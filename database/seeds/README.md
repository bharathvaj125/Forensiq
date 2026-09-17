# database/seeds/

**Purpose:** Reproducible demo/seed data scripts so the platform can be
demoed on any machine or deployment target with consistent data
(Roadmap Milestone 9 requirement: "seed data script reproducible on any
machine/deploy target").

**Responsibility:** Populate both the base relational schema and the new
platform tables (`users`, `roles`, `user_jurisdictions`, etc.) with
representative rows covering every role in the RBAC matrix (SAD Section 8.2).

**Used by:** Local dev setup (`docs/setup/`), CI test fixtures, Demo Day prep.
