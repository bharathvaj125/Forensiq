# Karnataka Police FIR System — Synthetic Dataset Design Strategy
### Crime Intelligence & AI Training Dataset Blueprint (Schema-Only Analysis — No Data Generated)

This document analyzes the ER schema table-by-table and defines a generation strategy for a realistic, ML-ready synthetic dataset. **No records or CSVs are generated here** — this is the design blueprint.

---

## 1. CaseMaster (Core Transaction Table)

| Field | Detail |
|---|---|
| **Purpose** | The central FIR/case record — anchors every crime event (when, where, who registered it, category, gravity, status, court) |
| **Table Type** | Transaction Table (Fact Table) |
| **Approx Records** | 50,000 – 200,000 (this is your fact table; scale drives everything downstream) |
| **Useful For** | Hotspot Detection ✅, Pattern/Trend Discovery ✅, Network Analysis ✅, Repeat Offender ✅, MO Detection ✅, Link Analysis ✅, Anomaly Detection ✅, Predictive Risk Scoring ✅ (essential for ALL 8 use cases) |
| **Skip in V1?** | ❌ No — this is the backbone |
| **Primary Key** | CaseMasterID |
| **Foreign Keys** | PolicePersonID→Employee, PoliceStationID→Unit, CaseCategoryID→CaseCategory, GravityOffenceID→GravityOffence, CrimeMajorHeadID→CrimeHead, CrimeMinorHeadID→CrimeSubHead, CaseStatusID→CaseStatusMaster, CourtID→Court |
| **Dependents** | ComplainantDetails, Victim, Accused, ArrestSurrender, ActSectionAssociation, ChargesheetDetails, Inv_OccuranceTime |
| **Group** | **A — Must Generate First** |

---

## 2. ComplainantDetails (Transaction Table)

| Field | Detail |
|---|---|
| **Purpose** | Who filed the FIR — demographic profile of complainants |
| **Table Type** | Transaction Table |
| **Approx Records** | 50,000 – 220,000 (~1.1x CaseMaster; a few cases have multiple complainants) |
| **Useful For** | Pattern/Trend Discovery ✅, Anomaly Detection ✅ (demographic bias/anomaly checks), Predictive Risk Scoring ⚠️ (secondary) |
| **Skip in V1?** | ⚠️ Partially — can simplify to 1:1 with CaseMaster in V1 |
| **Primary Key** | ComplainantID |
| **Foreign Keys** | CaseMasterID→CaseMaster, OccupationID→OccupationMaster, ReligionID→ReligionMaster, CasteID→CasteMaster |
| **Dependents** | None (leaf table) |
| **Group** | **B — Generate After Core Tables** |

---

## 3. Victim (Transaction Table)

| Field | Detail |
|---|---|
| **Purpose** | Captures victim(s) per case — critical for gravity/severity modeling |
| **Table Type** | Transaction Table |
| **Approx Records** | 55,000 – 250,000 (multiple victims per case, esp. group crimes) |
| **Useful For** | Pattern/Trend Discovery ✅, MO Detection ✅ (victim profile is part of MO), Predictive Risk Scoring ✅, Anomaly Detection ✅ |
| **Skip in V1?** | ❌ No — needed for crime severity/pattern modeling |
| **Primary Key** | VictimMasterID |
| **Foreign Keys** | CaseMasterID→CaseMaster |
| **Dependents** | None |
| **Group** | **B — Generate After Core Tables** |

---

## 4. Accused (Transaction Table)

| Field | Detail |
|---|---|
| **Purpose** | Accused persons per case — the backbone of repeat-offender and network analysis |
| **Table Type** | Transaction Table |
| **Approx Records** | 60,000 – 300,000 (multiple accused per case is common) |
| **Useful For** | Network Analysis ✅ (co-accused graphs), Repeat Offender Detection ✅ (critical — needs same person across cases), MO Detection ✅, Link Analysis ✅, Predictive Risk Scoring ✅ |
| **Skip in V1?** | ❌ No — this is the second most important table after CaseMaster |
| **Primary Key** | AccusedMasterID |
| **Foreign Keys** | CaseMasterID→CaseMaster |
| **Dependents** | ArrestSurrender (via inv_arrestsurrenderaccused), inv_arrestsurrenderaccused |
| **Group** | **A — Must Generate First** (jointly with CaseMaster, since repeat-offender modeling needs identity consistency built in from the start — see Design Note below) |

---

## 5. ArrestSurrender (Transaction Table)

| Field | Detail |
|---|---|
| **Purpose** | Tracks arrest/surrender events tied to a case and accused |
| **Table Type** | Transaction Table |
| **Approx Records** | 40,000 – 150,000 (not all accused get arrested — some remain absconding) |
| **Useful For** | Repeat Offender Detection ✅, Network Analysis ✅ (IO-accused-court linkages), Link Analysis ✅, Anomaly Detection ⚠️ (delay-in-arrest anomalies), Predictive Risk Scoring ⚠️ |
| **Skip in V1?** | ⚠️ Optional-lite — can be simplified/deferred to V1.5 if timeline is tight |
| **Primary Key** | ArrestSurrenderID |
| **Foreign Keys** | CaseMasterID→CaseMaster, ArrestSurrenderStateId→State, ArrestSurrenderDistrictId→District, PoliceStationID→Unit, IOID→Employee, CourtID→Court, AccusedMasterID→Accused |
| **Dependents** | inv_arrestsurrenderaccused |
| **Group** | **B — Generate After Core Tables** |

---

## 6. inv_arrestsurrenderaccused (Junction/Relationship Table — referenced in Relationship Matrix but not detailed in schema doc)

| Field | Detail |
|---|---|
| **Purpose** | Many-to-many bridge when one arrest event covers multiple accused persons (e.g., group arrests) |
| **Table Type** | Relationship (Junction) Table |
| **Approx Records** | 45,000 – 160,000 |
| **Useful For** | Network Analysis ✅ (co-arrest graphs), Link Analysis ✅ |
| **Skip in V1?** | ✅ Yes — safe to skip in V1; assume 1:1 arrest-to-accused initially and add this junction later |
| **Primary Key** | Not specified — recommend composite (ArrestSurrenderID, AccusedMasterID) |
| **Foreign Keys** | ArrestSurrenderID→ArrestSurrender, AccusedMasterID→Accused |
| **Dependents** | None |
| **Group** | **C — Optional for Version 1** |

---

## 7. ActSectionAssociation (Relationship Table)

| Field | Detail |
|---|---|
| **Purpose** | Links a case to the legal Act(s) and Section(s) invoked — legal classification of the crime |
| **Table Type** | Relationship Table (junction between CaseMaster, Act, Section) |
| **Approx Records** | 70,000 – 350,000 (avg 2–3 sections per case) |
| **Useful For** | Pattern/Trend Discovery ✅ (which sections trend), MO Detection ✅ (section combos = MO signature), Predictive Risk Scoring ✅ |
| **Skip in V1?** | ❌ No — legal classification is core to crime pattern modeling |
| **Primary Key** | Composite: (CaseMasterID, ActID, SectionID) — no single PK defined in schema |
| **Foreign Keys** | CaseMasterID→CaseMaster, ActID→Act.ActCode, SectionID→Section.SectionCode |
| **Dependents** | None |
| **Group** | **B — Generate After Core Tables** |

---

## 8. ChargesheetDetails (Transaction Table)

| Field | Detail |
|---|---|
| **Purpose** | Final disposition of investigation — chargesheet filed, false case, or undetected |
| **Table Type** | Transaction Table |
| **Approx Records** | 30,000 – 150,000 (only closed/disposed cases will have this) |
| **Useful For** | Predictive Risk Scoring ✅ (outcome label — very valuable as a target variable), Anomaly Detection ✅ (false-case rate anomalies), Pattern/Trend Discovery ⚠️ |
| **Skip in V1?** | ⚠️ Optional but recommended — this is your best candidate for a supervised-learning **target label** (charge-sheeted vs false vs undetected) |
| **Primary Key** | CSID |
| **Foreign Keys** | CaseMasterID→CaseMaster, PolicePersonID→Employee |
| **Dependents** | None |
| **Group** | **B — Generate After Core Tables** |

---

## 9. Inv_OccuranceTime (One-to-One with CaseMaster — referenced in Relationship Matrix, not detailed)

| Field | Detail |
|---|---|
| **Purpose** | Likely holds normalized incident date/time/location detail separately from CaseMaster (based on relationship matrix — 1:1 with CaseMaster) |
| **Table Type** | Transaction Table (1:1 extension of CaseMaster) |
| **Approx Records** | Equal to CaseMaster count (1:1) |
| **Useful For** | Hotspot Detection ✅, Pattern/Trend Discovery ✅ |
| **Skip in V1?** | ✅ Yes — schema already carries IncidentFromDate/ToDate, latitude/longitude directly in CaseMaster, so this table is redundant for V1. Only needed if the real system splits it out |
| **Primary Key** | Not specified (assume CaseMasterID as PK/FK) |
| **Foreign Keys** | CaseMasterID→CaseMaster |
| **Dependents** | None |
| **Group** | **C — Optional for Version 1** |

---

## 10. Act (Master Table)

| Field | Detail |
|---|---|
| **Purpose** | Master list of legal acts (IPC, NDPS, POCSO, etc.) |
| **Table Type** | Master Table |
| **Approx Records** | 15 – 40 (small, finite, real-world list) |
| **Useful For** | MO Detection ✅, Pattern/Trend Discovery ✅ |
| **Skip in V1?** | ❌ No — needed to populate ActSectionAssociation meaningfully |
| **Primary Key** | ActCode |
| **Foreign Keys** | None |
| **Dependents** | Section, ActSectionAssociation, CrimeHeadActSection |
| **Group** | **A — Must Generate First** |

---

## 11. Section (Master Table)

| Field | Detail |
|---|---|
| **Purpose** | Sections under each Act (e.g., IPC 302, 307) |
| **Table Type** | Master Table |
| **Approx Records** | 300 – 600 (real IPC/NDPS/POCSO section counts) |
| **Useful For** | MO Detection ✅ (section = crime signature), Pattern/Trend Discovery ✅ |
| **Skip in V1?** | ❌ No |
| **Primary Key** | SectionCode (composite uniqueness with ActCode recommended) |
| **Foreign Keys** | ActCode→Act |
| **Dependents** | ActSectionAssociation, CrimeHeadActSection |
| **Group** | **A — Must Generate First** |

---

## 12. CrimeHead (Master Table)

| Field | Detail |
|---|---|
| **Purpose** | Major crime classification group (e.g., "Crimes Against Body," "Crimes Against Property") |
| **Table Type** | Master Table |
| **Approx Records** | 10 – 20 |
| **Useful For** | Hotspot Detection ✅, Pattern/Trend Discovery ✅, Predictive Risk Scoring ✅ |
| **Skip in V1?** | ❌ No — used as the primary crime-type label in most ML models |
| **Primary Key** | CrimeHeadID |
| **Foreign Keys** | None |
| **Dependents** | CrimeSubHead, CaseMaster, CrimeHeadActSection |
| **Group** | **A — Must Generate First** |

---

## 13. CrimeSubHead (Master Table)

| Field | Detail |
|---|---|
| **Purpose** | Specific crime type under a major head (e.g., Murder, Robbery under "Crimes Against Body") |
| **Table Type** | Master Table |
| **Approx Records** | 60 – 150 |
| **Useful For** | Hotspot Detection ✅, Pattern/Trend Discovery ✅, MO Detection ✅, Predictive Risk Scoring ✅ |
| **Skip in V1?** | ❌ No — your most granular crime-type dimension, very high ML value |
| **Primary Key** | CrimeSubHeadID |
| **Foreign Keys** | CrimeHeadID→CrimeHead |
| **Dependents** | CaseMaster |
| **Group** | **A — Must Generate First** |

---

## 14. CrimeHeadActSection (Relationship / Mapping Table)

| Field | Detail |
|---|---|
| **Purpose** | Maps which Act+Section combinations apply to which crime head (a legal-to-classification lookup bridge) |
| **Table Type** | Relationship Table |
| **Approx Records** | 200 – 500 |
| **Useful For** | MO Detection ⚠️ (helps validate consistency, not primary signal) |
| **Skip in V1?** | ✅ Yes — a reference/validation table; not required to run analytics, only to validate legal-classification consistency |
| **Primary Key** | Composite (CrimeHeadID, ActCode, SectionCode) — none defined explicitly |
| **Foreign Keys** | CrimeHeadID→CrimeHead, ActCode→Act, SectionCode→Section |
| **Dependents** | None |
| **Group** | **C — Optional for Version 1** |

---

## 15. CaseCategory (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | FIR/UDR/PAR/Zero FIR category — also embedded in CrimeNo structure |
| **Table Type** | Lookup Table |
| **Approx Records** | 4 – 8 |
| **Useful For** | Pattern/Trend Discovery ✅ (category-wise trend analysis) |
| **Skip in V1?** | ❌ No — tiny table, trivial to generate, needed for CrimeNo logic |
| **Primary Key** | CaseCategoryID |
| **Foreign Keys** | None |
| **Dependents** | CaseMaster |
| **Group** | **A — Must Generate First** |

---

## 16. GravityOffence (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Heinous vs Non-Heinous classification |
| **Table Type** | Lookup Table |
| **Approx Records** | 2 – 5 |
| **Useful For** | Predictive Risk Scoring ✅ (strong severity signal), Anomaly Detection ✅ |
| **Skip in V1?** | ❌ No — cheap to generate, high analytical value |
| **Primary Key** | GravityOffenceID |
| **Foreign Keys** | None |
| **Dependents** | CaseMaster |
| **Group** | **A — Must Generate First** |

---

## 17. CaseStatusMaster (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Case lifecycle status (Under Investigation, Charge Sheeted, Closed, etc.) |
| **Table Type** | Lookup Table |
| **Approx Records** | 4 – 10 |
| **Useful For** | Predictive Risk Scoring ✅ (potential label/target), Anomaly Detection ✅ (stuck/delayed cases) |
| **Skip in V1?** | ❌ No |
| **Primary Key** | CaseStatusID |
| **Foreign Keys** | None |
| **Dependents** | CaseMaster |
| **Group** | **A — Must Generate First** |

---

## 18. Court (Master Table)

| Field | Detail |
|---|---|
| **Purpose** | Court where case is tried / accused produced |
| **Table Type** | Master Table |
| **Approx Records** | 200 – 400 (realistic Karnataka court count across districts) |
| **Useful For** | Network Analysis ⚠️ (court-district linkages), Link Analysis ⚠️ |
| **Skip in V1?** | ⚠️ Optional-lite — can generate a minimal placeholder set; not central to most of the 8 analytics use cases |
| **Primary Key** | CourtID |
| **Foreign Keys** | DistrictID→District, StateID→State |
| **Dependents** | CaseMaster, ArrestSurrender |
| **Group** | **B — Generate After Core Tables** |

---

## 19. State (Master Table — Geo Hierarchy)

| Field | Detail |
|---|---|
| **Purpose** | Top of the geographic hierarchy |
| **Table Type** | Master Table |
| **Approx Records** | 1 (Karnataka only, if scoped state-wise) or ~36 (if all-India reference) |
| **Useful For** | Hotspot Detection ✅ (geo dimension root) |
| **Skip in V1?** | ❌ No — required as FK root for District/Unit/Court |
| **Primary Key** | StateID |
| **Foreign Keys** | None |
| **Dependents** | District, Court, Unit, ArrestSurrender |
| **Group** | **A — Must Generate First** |

---

## 20. District (Master Table — Geo Hierarchy)

| Field | Detail |
|---|---|
| **Purpose** | District-level geo unit — critical for hotspot mapping |
| **Table Type** | Master Table |
| **Approx Records** | 31 (actual Karnataka district count) |
| **Useful For** | Hotspot Detection ✅ (primary geo grouping), Pattern/Trend Discovery ✅ |
| **Skip in V1?** | ❌ No — essential geo dimension |
| **Primary Key** | DistrictID |
| **Foreign Keys** | StateID→State |
| **Dependents** | Court, Unit, Employee, ArrestSurrender |
| **Group** | **A — Must Generate First** |

---

## 21. Unit (Master Table — Police Station Hierarchy)

| Field | Detail |
|---|---|
| **Purpose** | Police station / circle / range hierarchy (self-referencing via ParentUnit) |
| **Table Type** | Master Table |
| **Approx Records** | 1,000 – 1,500 (Karnataka has ~1,100+ police stations/units incl. hierarchy levels) |
| **Useful For** | Hotspot Detection ✅ (finest geo grain), Network Analysis ✅ (jurisdiction chains), Pattern/Trend Discovery ✅ |
| **Skip in V1?** | ❌ No — this is your finest-grain location dimension, essential for hotspot mapping |
| **Primary Key** | UnitID |
| **Foreign Keys** | TypeID→UnitType, StateID→State, DistrictID→District, ParentUnit→Unit (self-ref) |
| **Dependents** | CaseMaster, Employee, ArrestSurrender |
| **Group** | **A — Must Generate First** |

---

## 22. UnitType (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Classifies Unit as Police Station / Circle / Range / District office etc. |
| **Table Type** | Lookup Table |
| **Approx Records** | 5 – 12 |
| **Useful For** | Network Analysis ⚠️ (org hierarchy context) |
| **Skip in V1?** | ⚠️ Can hardcode a minimal 4–5 value set; not analytically central by itself |
| **Primary Key** | UnitTypeID |
| **Foreign Keys** | None |
| **Dependents** | Unit |
| **Group** | **A — Must Generate First** (tiny, needed to populate Unit) |

---

## 23. Rank (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Police rank hierarchy (Constable → DGP) |
| **Table Type** | Lookup Table |
| **Approx Records** | 15 – 25 (real Karnataka Police rank structure) |
| **Useful For** | Network Analysis ⚠️ (officer hierarchy in graphs) |
| **Skip in V1?** | ⚠️ Optional-lite — nice-to-have for realism, not essential to the 8 core analytics |
| **Primary Key** | RankID |
| **Foreign Keys** | None |
| **Dependents** | Employee |
| **Group** | **B — Generate After Core Tables** |

---

## 24. Designation (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Functional designation (Investigating Officer, SHO, etc.) |
| **Table Type** | Lookup Table |
| **Approx Records** | 10 – 20 |
| **Useful For** | Network Analysis ⚠️ |
| **Skip in V1?** | ⚠️ Optional-lite, same reasoning as Rank |
| **Primary Key** | DesignationID |
| **Foreign Keys** | None |
| **Dependents** | Employee |
| **Group** | **B — Generate After Core Tables** |

---

## 25. Employee (Master Table)

| Field | Detail |
|---|---|
| **Purpose** | Police personnel — officers who register FIRs and investigate cases |
| **Table Type** | Master Table |
| **Approx Records** | 5,000 – 15,000 (realistic Karnataka Police strength subset for a synthetic model) |
| **Useful For** | Network Analysis ✅ (officer-case-court graphs), Repeat Offender Detection ⚠️ (officer workload patterns), Anomaly Detection ✅ (officer-level anomaly, e.g. unusually high false-case rate) |
| **Skip in V1?** | ❌ No — needed to populate PolicePersonID/IOID across CaseMaster & ArrestSurrender realistically |
| **Primary Key** | EmployeeID |
| **Foreign Keys** | DistrictID→District, UnitID→Unit, RankID→Rank, DesignationID→Designation |
| **Dependents** | CaseMaster, ArrestSurrender, ChargesheetDetails |
| **Group** | **A — Must Generate First** |

---

## 26. CasteMaster (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Caste reference for complainant demographics |
| **Table Type** | Lookup Table |
| **Approx Records** | 20 – 50 |
| **Useful For** | Anomaly Detection ⚠️ (demographic bias auditing only — **handle with strong ethical care**) |
| **Skip in V1?** | ⚠️ Recommended to **defer or anonymize/aggregate** — sensitive attribute; only include if your project has explicit ethical review/IRB-style clearance and a defensible analytical use case |
| **Primary Key** | caste_master_id |
| **Foreign Keys** | None |
| **Dependents** | ComplainantDetails |
| **Group** | **C — Optional for Version 1** (ethical caution flag) |

---

## 27. ReligionMaster (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Religion reference for complainant demographics |
| **Table Type** | Lookup Table |
| **Approx Records** | 6 – 10 |
| **Useful For** | Same ethical caution as CasteMaster |
| **Skip in V1?** | ⚠️ Same recommendation — defer unless justified and reviewed |
| **Primary Key** | ReligionID |
| **Foreign Keys** | None |
| **Dependents** | ComplainantDetails |
| **Group** | **C — Optional for Version 1** (ethical caution flag) |

---

## 28. OccupationMaster (Lookup Table)

| Field | Detail |
|---|---|
| **Purpose** | Complainant occupation reference |
| **Table Type** | Lookup Table |
| **Approx Records** | 30 – 60 |
| **Useful For** | Pattern/Trend Discovery ⚠️ (mild secondary signal, e.g. victim/complainant occupation trends) |
| **Skip in V1?** | ⚠️ Optional-lite — low priority, not ethically sensitive, generate if time allows |
| **Primary Key** | OccupationID |
| **Foreign Keys** | None |
| **Dependents** | ComplainantDetails |
| **Group** | **C — Optional for Version 1** |

---

# Summary Table

| # | Table | Type | Group | Records (approx) | Skip V1? |
|---|---|---|---|---|---|
| 1 | State | Master | A | 1–36 | No |
| 2 | District | Master | A | 31 | No |
| 3 | UnitType | Lookup | A | 5–12 | No |
| 4 | Unit | Master | A | 1,000–1,500 | No |
| 5 | CaseCategory | Lookup | A | 4–8 | No |
| 6 | GravityOffence | Lookup | A | 2–5 | No |
| 7 | CaseStatusMaster | Lookup | A | 4–10 | No |
| 8 | CrimeHead | Master | A | 10–20 | No |
| 9 | CrimeSubHead | Master | A | 60–150 | No |
| 10 | Act | Master | A | 15–40 | No |
| 11 | Section | Master | A | 300–600 | No |
| 12 | Employee | Master | A | 5,000–15,000 | No |
| 13 | CaseMaster | Transaction | A | 50,000–200,000 | No |
| 14 | Accused | Transaction | A | 60,000–300,000 | No |
| 15 | Victim | Transaction | B | 55,000–250,000 | No |
| 16 | ComplainantDetails | Transaction | B | 50,000–220,000 | Partial |
| 17 | ActSectionAssociation | Relationship | B | 70,000–350,000 | No |
| 18 | ArrestSurrender | Transaction | B | 40,000–150,000 | Partial |
| 19 | ChargesheetDetails | Transaction | B | 30,000–150,000 | Recommended, not mandatory |
| 20 | Court | Master | B | 200–400 | Partial |
| 21 | Rank | Lookup | B | 15–25 | Partial |
| 22 | Designation | Lookup | B | 10–20 | Partial |
| 23 | inv_arrestsurrenderaccused | Junction | C | 45,000–160,000 | Yes |
| 24 | Inv_OccuranceTime | Transaction | C | = CaseMaster count | Yes |
| 25 | CrimeHeadActSection | Relationship | C | 200–500 | Yes |
| 26 | OccupationMaster | Lookup | C | 30–60 | Yes |
| 27 | CasteMaster | Lookup | C | 20–50 | Yes (ethical flag) |
| 28 | ReligionMaster | Lookup | C | 6–10 | Yes (ethical flag) |

---

# Generation Order (Dependency-Safe Sequence)

**Phase 1 — Group A (foundation, generate first, no dependencies on transaction data):**
State → District → UnitType → Unit → CaseCategory → GravityOffence → CaseStatusMaster → CrimeHead → CrimeSubHead → Act → Section → Employee

**Phase 2 — Group A transaction core (depends only on Phase 1):**
CaseMaster → Accused

**Phase 3 — Group B (depends on Phase 1 + 2):**
Victim → ComplainantDetails (+ OccupationMaster/ReligionMaster/CasteMaster if included) → ActSectionAssociation → ArrestSurrender → Court → Rank → Designation → ChargesheetDetails

**Phase 4 — Group C (optional, add once V1 is validated):**
inv_arrestsurrenderaccused → Inv_OccuranceTime → CrimeHeadActSection → remaining demographic lookups

---

# Key Design Notes for Realism & ML Usefulness

1. **Repeat Offender Detection requires deliberate identity reuse.** Unlike most tables, `Accused` should NOT be purely independent-random per case — a percentage (e.g. 8–15%) of accused identities should deliberately recur across multiple `CaseMasterID` records (same name/age-band/approximate location) to simulate real repeat-offender patterns. This is why Accused is placed in Group A alongside CaseMaster rather than Group B — its generation logic needs to be co-designed with CaseMaster's temporal/geographic spread from the start.
2. **CrimeNo encoding must be generated programmatically**, not randomly: 1-digit CaseCategory + 4-digit DistrictID + 4-digit UnitID + 4-digit Year + 5-digit running serial, with the serial reset per Unit+Category+Year — this needs District and Unit tables finalized first.
3. **Geo fields (latitude/longitude) in CaseMaster** should be sampled within real bounding boxes of the assigned District/Unit to make Hotspot Detection meaningful rather than uniformly random across Karnataka.
4. **ChargesheetDetails is your strongest candidate for a supervised target label** (chargesheet vs false case vs undetected) for Predictive Risk Scoring — worth prioritizing even though it's Group B.
5. **CasteMaster/ReligionMaster carry ethical sensitivity.** Recommend either omitting them from V1, using coarse/aggregated categories only, or ensuring your project has appropriate ethical review before using them as model features — especially if any output could influence policing decisions on real individuals.
6. **Unit's self-referencing ParentUnit** needs a small hierarchy design (e.g., State Range → District → Sub-Division → Police Station) decided before generation, since it affects both Unit record count and realism of jurisdiction chains for Network Analysis.

---

*This document is a design blueprint only. No synthetic records or files have been generated at this stage — the next step, when you're ready, is to lock in Group A record counts and generation rules table-by-table.*
