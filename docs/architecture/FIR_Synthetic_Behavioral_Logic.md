# Karnataka Police FIR System — Hidden Behavioural Logic Design
### The Rules Engine Behind the Synthetic World (No Records Generated — Logic Only)

Everything below is a **rule specification**, not data. These rules are what the generator must consult *before* writing any row, so that every FK link, every repeated name, every timestamp cluster has a traceable cause instead of being drawn independently at random.

The core design principle: **entities carry persistent hidden state that outlives a single case.** A person, a gang, a location, and a time-of-day each have a "profile" object that the generator samples FROM consistently — this is what creates realistic correlation instead of noise.

---

## 1. Criminal Profiles

Every synthetic `Accused` identity that will reappear across cases (your designated repeat-offender pool, from the previous design's 8–15% recurrence rule) gets a **hidden Criminal Profile** — invisible in the final schema, but the thing the generator uses to decide *everything else about that person consistently*.

**Profile attributes (hidden state, not a DB table):**
- `criminal_type`: one archetype from a fixed set — e.g. `Property Offender`, `Violent Offender`, `Narcotics Offender`, `Cyber/Financial Offender`, `Juvenile Petty Offender`, `Organized Gang Member`, `Habitual Public-Order Offender`
- `escalation_curve`: flat / slow-escalating / rapid-escalating / de-escalating (post-arrest reform) — drives whether their crimes get more severe over their timeline
- `operating_radius`: local (same Unit jurisdiction), district-wide, or inter-district — constrains which `Unit`/`District` their future cases can appear in
- `risk_tolerance`: low/medium/high — affects whether they operate alone or need co-accused, and how often they get caught (arrest latency)
- `active_years`: a start and (optional) end year — a person shouldn't have cases spanning 1998–2026 unless explicitly modeled as a long-career offender
- `gang_affiliation_id`: null, or a link to a hidden Gang Profile (see Section 2)

**Rule:** every field generated for this person's `Accused` rows (age progression, crime type, location, MO, co-accused) must be sampled *conditioned on* this profile, not independently. Example: a `Property Offender` with `operating_radius = local` should never show up committing a violent crime three districts away — that breaks the logic the analytics are supposed to detect.

**Non-repeat accused** (the majority, one-time appearances) don't need a persistent profile — they can be drawn from simpler demographic distributions, since they exist mainly to populate case volume, not to carry patterns.

---

## 2. Gang Behaviour

A hidden `Gang Profile` (again, not a schema table — an internal generator construct) governs clusters of `Criminal Profiles` that should behave as a coordinated unit.

**Gang Profile attributes:**
- `gang_id` (internal only)
- `core_members`: 3–12 persistent Criminal Profiles who recur together
- `peripheral_members`: a larger, loosely-associated pool (occasional co-accused, not always present)
- `specialization`: the gang's dominant crime sub-head(s) — e.g. chain-snatching gang, vehicle-theft ring, narcotics trafficking network, organized cybercrime cell
- `territory`: one or more `Unit`/`District` IDs where the gang is dominant — cases from this gang cluster geographically
- `hierarchy`: one "lead" profile (higher `risk_tolerance`, lower arrest frequency, appears as co-accused but rarely as primary arrestee) + subordinate members (higher arrest frequency, take the fall more often)
- `lifecycle_state`: forming → active → law-enforcement-disrupted → dormant/dissolved (a gang shouldn't stay "active" forever — real networks get broken up)

**Rules the generator must follow:**
1. When generating a case tagged to a gang's specialization inside its territory, co-accused should be drawn preferentially from that gang's member pool (core members appear together far more often than chance).
2. The "lead" profile's name should appear in `Accused` less frequently than subordinates relative to case count — mirroring real hierarchy (leaders insulate themselves).
3. Once a gang enters `disrupted` state (triggered after N members have `ArrestSurrender` records within a short time window — simulating a police crackdown), subsequent case generation for that gang should drop sharply or shift to a new gang_id with partial membership overlap (splinter-group realism).
4. Not every co-accused case implies a gang — solo/opportunistic co-offending (e.g. two acquaintances committing one impulsive crime) should also exist and must NOT be mistaken for gang structure. Recommend: only clusters with ≥3 shared case appearances across ≥2 distinct cases qualify as a "gang" signal; everything below that is incidental co-offending.

---

## 3. Crime Evolution Over Time

Time is not just a random `IncidentFromDate` — it must reflect trends the Pattern/Trend Discovery use case is supposed to find.

**Rules:**
1. **Macro trend curves per CrimeSubHead**: assign each crime sub-head a multi-year trend shape — rising (e.g. cybercrime-adjacent theft rising post-2022), falling (e.g. a crime type declining after a policy change), cyclical/seasonal (e.g. chain-snatching spikes around festival seasons), or flat/stable (e.g. baseline assault rate). Case volume per sub-head per year should follow this curve, not be uniform.
2. **Policy/event shock points**: define a small number of fixed "events" on the synthetic timeline (e.g. a new anti-narcotics drive starting a given year, a new CCTV rollout in a district) that cause a step-change (up or down) in relevant crime sub-head volume or in arrest-speed metrics from that point forward. This gives Anomaly Detection something real to find.
3. **Individual escalation**: tie back to Criminal Profile's `escalation_curve` — a profile marked "rapid-escalating" should show increasing `GravityOffence` severity across their successive case timestamps; "de-escalating" profiles should show reducing severity or increasing gaps between cases after an arrest (simulating deterrence or reform).
4. **Seasonality within a year**: certain sub-heads get a month/week weighting (e.g. property crime upticks around major festivals and year-end; certain public-order offences spike around elections/political events) — this must be a lookup table of weights per sub-head, not left to chance.
5. **Case backlog realism**: `CaseStatusMaster` progression over time should correlate with case age — older cases should skew toward "Charge Sheeted"/"Closed", very recent cases should skew toward "Under Investigation". A 2026 case marked "Closed" on the day it's filed is a logic violation.

---

## 4. Preferred Crime Methods (Modus Operandi)

MO must be a **stable signature per Criminal Profile / Gang**, not re-rolled per case.

**Rules:**
1. Each Criminal Profile/Gang gets a fixed small set (1–3) of preferred `Act`+`Section` combinations and `CrimeSubHead` values — their "signature." New cases attributed to them should draw from this fixed set with high probability (e.g. 70–85%), with a small chance (~15–30%) of a one-off deviation (people do occasionally commit an atypical crime — full determinism would look artificial).
2. MO signature should include a consistent **entry/execution method** dimension even though the schema doesn't have an explicit "MO" field — encode it through consistent combinations of: time-of-day preference (Section 7), location-type preference (Section 6), weapon/section invoked (e.g. always Section for "criminal force" vs a knife-related section), and victim profile (Section 8). It's the *combination* that forms the MO fingerprint, not any single field.
3. Gangs should show tighter MO consistency than solo offenders (organized = more repeatable signature; opportunistic individuals = more variable).
4. MO drift over time is allowed and should be tied to the `escalation_curve` — e.g. a property offender escalating toward violent confrontation during thefts (a known real-world pattern) should show a slow shift in their signature Section over successive cases, not a random jump.

---

## 5. Preferred Vehicles

The schema doesn't currently have an explicit Vehicle table/field — flag this as a schema gap. Two options:

**Option A (recommended for V1):** Encode vehicle involvement implicitly through `CrimeSubHead` (e.g. "Vehicle Theft," "Hit and Run") and `BriefFacts` text generation only — no dedicated hidden logic needed beyond MO rules in Section 4.

**Option B (if a Vehicle dimension is added later):** If you extend the schema with a `VehicleInvolved` table, apply this hidden logic:
- Each Criminal Profile/Gang gets a preferred `vehicle_category` (two-wheeler, auto, stolen four-wheeler, none/on-foot) consistent with their crime type — e.g. chain-snatching gangs skew heavily toward two-wheelers; vehicle-theft rings skew toward four-wheelers; cyber/financial offenders skew toward "none."
- Vehicle preference should correlate with `operating_radius` — inter-district-radius profiles need a vehicle; hyper-local profiles are more likely on-foot.
- Repeated use of a similar (not identical, to avoid trivial detection) vehicle description across a profile's cases is itself a Link Analysis signal — this is intentional and should be preserved, not randomized away.

---

## 6. Preferred Locations

Location must be **anchored to profile/gang territory**, not uniformly random across all `Unit`/`District` values.

**Rules:**
1. Every Criminal Profile has a `home_unit` (derived from their first-ever case) and an `operating_radius` (Section 1). All subsequent cases for that profile must sample `PoliceStationID` from within that radius — local offenders stay in 1–2 neighboring Units; inter-district offenders can range across a small fixed cluster of Units, not the entire state.
2. Gang cases must sample from the gang's `territory` list (Section 2), with a dominant "home turf" Unit getting disproportionately more of their cases (e.g. 60%+) and the remaining territory Units splitting the rest.
3. **Location-type by crime sub-head**: maintain a lookup of plausible location archetypes per sub-head (e.g. residential-burglary near residential zones, chain-snatching near markets/bus-stops/ATMs, cybercrime location-agnostic, narcotics near known transit/border-adjacent Units) — this drives which Units are eligible pools per sub-head even for non-repeat, one-off accused.
4. **Hotspot reinforcement**: designate a small number of Units per district as structurally higher-crime "hotspot" Units (reflecting real urban-density effects) and bias overall case-volume sampling toward them, independent of any specific profile — this is what makes Hotspot Detection produce a non-trivial, non-uniform heatmap.
5. Latitude/longitude sampled within the chosen Unit's real bounding box (as noted in the prior design doc), further biased toward a small number of "micro-hotspot" coordinate clusters within that Unit rather than uniform scatter — real crime clusters at specific intersections/markets, not evenly across a jurisdiction.

---

## 7. Preferred Crime Times

Time-of-day and day-of-week must be sub-head- and profile-conditioned.

**Rules:**
1. Maintain an **hour-of-day weighting table per CrimeSubHead** — e.g. residential burglary skews late-night/early-morning (11pm–5am); chain-snatching skews evening rush hour and early morning walking hours; domestic/violent offences skew evening/night; cybercrime/financial fraud is business-hours-agnostic (can be any time, victim-side triggered); public-order offences skew around specific event times (post-match, post-political-rally hours).
2. **Day-of-week weighting**: property crime often skews toward specific days (e.g. paydays, weekends when houses are empty for travel); public-order/violent offences may skew toward weekends/festival days.
3. Each Criminal Profile/Gang additionally gets a personal preferred time-window (a narrower band within the sub-head's general window) reflecting their operational habit — reinforcing MO consistency (Section 4) and giving Link Analysis a temporal fingerprint to find, in addition to the geographic and vehicle ones.
4. `InfoReceivedPSDate` should lag `IncidentFromDate/ToDate` by a plausible, sub-head-conditioned delay distribution (e.g. violent crime reported within hours; some property crime discovered/reported days later; certain sensitive crimes reported with longer, right-skewed delay) — not a fixed or uniform-random gap.

---

## 8. Victim Selection Logic

Victims should not be demographically independent of the crime type/location — real offending has target patterns.

**Rules:**
1. **Vulnerability-conditioned targeting per sub-head**: e.g. property crime skews toward victims who are house-owners/away-travelers (age/occupation proxies), chain-snatching skews toward lone pedestrians (often women, elderly, or during low-foot-traffic windows — reflect this via age/gender distribution weighting, not explicit protected-attribute targeting logic in the write-up), financial fraud skews toward victims with higher digital-transaction exposure (working-age, urban Units), certain violent crime sub-heads correlate with known-relationship victim-accused pairs (domestic/interpersonal) vs stranger pairs (robbery/street crime) — maintain a `relationship_prior` field (known vs stranger) per sub-head.
2. **Repeat-victim edge case**: allow a small percentage (~2–5%) of victims to reappear across multiple cases (reflecting real repeat-victimization patterns, e.g. harassment/stalking case sequences, or a shop repeatedly targeted for theft) — this should attach to a lightweight hidden "Victim Profile" analogous to the Criminal Profile, only for this reappearing subset.
3. **Victim-location coupling**: victim's incident location should be drawn from the *same* Unit/hotspot logic as Section 6 (obviously — victims and incidents share a location), but victim's home-area vs incident-area can differ for a controlled fraction of cases (e.g. travel-related crime) to add realistic variance.
4. **Severity coupling**: `GravityOffence` should correlate with victim vulnerability markers (age extremes, gender, VictimPolice flag) in a way that mirrors real skew (e.g. cases with police-victims should be rarer but tend toward higher-profile handling/status) — again, drive this through statistical weighting, not hardcoded discriminatory rules.

---

## 9. Repeat Offender Logic

This formalizes what was flagged as essential in the prior design step.

**Rules:**
1. Maintain a **Repeat Offender Pool**: a fixed hidden list of Criminal Profiles (the 8–15% recurrence group from the DB design) each with a target `case_count_range` (e.g. 2–15 cases across their `active_years`).
2. **Inter-arrival time modeling**: time between a profile's successive cases should follow a distribution conditioned on `risk_tolerance` and prior `ArrestSurrender` outcomes — e.g. a short gap after release/bail, a long dormant gap while incarcerated (if `CaseStatusID` indicates conviction/custody), a shrinking gap over time for escalating profiles.
3. **Identity consistency vs obfuscation trade-off**: names/ages should stay logically consistent (same person, aging correctly year over year) but the generator should also inject a controlled fraction (~5–10%) of *near-duplicate* identity records (slight name spelling variants, inconsistent age entries) to simulate real-world data-entry inconsistency — this is intentional noise that a good entity-resolution/repeat-offender-detection model should have to overcome, making the dataset genuinely useful for training such models rather than trivially solvable by exact string match.
4. **Cross-linkage fields**: ensure repeat offenders' records are linkable via *at least one* stable field even under name variation (e.g. consistent age-band + home Unit + MO signature) so ground-truth evaluation of a detection model remains possible even though surface fields vary.
5. **Escalation/de-escalation enforcement**: tie each successive case's `GravityOffence` and `CrimeSubHead` drift explicitly to the profile's `escalation_curve` (Section 1) — this is the field-level mechanism that realizes the time-evolution logic from Section 3 at the individual level.

---

## 10. Hidden Network Logic

This is the layer that makes Network/Link Analysis non-trivial and realistic.

**Rules:**
1. **Multi-layer graph, not one flat graph.** The hidden network has at least three link types the generator must track internally: (a) co-accused links (same case, `Accused` table), (b) gang-membership links (Section 2, persistent across cases), (c) investigative links (same `Employee`/IOID handling multiple related cases — operationally meaningful, not criminal, but still a real link analysts use).
2. **Small-world structure, not random graph.** Real criminal networks cluster tightly (dense within-gang links) with a small number of "bridge" individuals connecting otherwise-separate gangs/clusters (e.g. a shared supplier, a shared fence for stolen goods, a shared lawyer/financier). Deliberately design a small number (2–5% of the repeat-offender pool) as bridge nodes that appear as peripheral co-accused across 2+ otherwise-unconnected gang clusters.
3. **Network decay/reformation**: mirror the gang `lifecycle_state` (Section 2) — when a gang is disrupted, its bridge nodes should reappear later linked to a *new* cluster (splinter/reformation), giving temporal network evolution rather than a static graph.
4. **Court/legal-network layer**: cases sharing the same `CourtID` or same defending pattern are a weaker, secondary link type — useful for corroborating investigative or legal-network analysis, but should not be conflated with actual criminal association. Keep this as a separate internal link-type tag so downstream users don't accidentally treat "same court" as "same gang."
5. **Non-obvious link injection**: deliberately ensure a portion of true network links are only discoverable through *indirect* joins (e.g. two accused never co-appear in the same case, but both appear as co-accused with a shared third bridge person in separate cases) — a dataset where all real links are single-hop/obvious under-tests the value of real link-analysis tooling. This indirect-link fraction should be a tunable generator parameter (recommend starting around 20–30% of total true links being indirect/multi-hop only).

---

# How These Ten Layers Interlock (Summary Logic Map)

```
Criminal Profile ──┬──> drives MO signature (4) ──> drives preferred location-type (6) & time (7)
                    ├──> drives escalation curve ──> drives crime evolution (3) & repeat offender severity drift (9)
                    ├──> drives operating radius ──> constrains location pool (6)
                    └──> optionally links to Gang Profile (2)
                              │
Gang Profile ───────┼──> shares MO signature across members (4)
                    ├──> shares territory ──> location clustering (6)
                    ├──> hierarchy ──> arrest-frequency skew (9)
                    └──> lifecycle state ──> network decay/reformation (10)

Victim Selection (8) ──> conditioned on crime sub-head + location (6) + time window (7)

Hidden Network (10) ──> built from co-accused (Accused/case links) + gang membership (2) +
                         bridge-node design + indirect multi-hop links

Crime Evolution (3) ──> macro trend curves + shock events, layered UNDER all individual-level
                         escalation so the population-level trend and the individual-level trend
                         are consistent with each other (an individual escalating during a
                         macro-declining crime type should be the exception, not standard)
```

**Core generator discipline going forward:** no field should be sampled independently if a hidden-state object above already constrains it. Every random draw must first check: *does this person/gang/location/time already have an established preference for this?* If yes, sample from that preference distribution; only fall back to population-level base rates for one-off, non-repeat entities where no persistent profile exists.

---

*This document defines behavioural rules only. No Criminal Profiles, Gang Profiles, or records have been instantiated. The next step, when ready, is to decide the concrete parameter values (exact distributions, weight tables, pool sizes) for each rule above before any generation code is written.*
