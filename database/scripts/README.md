# database/scripts/

**Purpose:** Operational DB scripts that don't belong in Alembic
migrations (backups, restores, materialized view refresh triggers).

**Responsibility:** `backup.sh` / `restore.sh` for demo-state snapshots
(Roadmap Milestone 9); `refresh_materialized_views.sh` for the
`mv_station_hotspot_scores` / `mv_officer_workload` / `mv_district_crime_trend`
/ `mv_repeat_offender_index` views from SAD Section 6.4.

**Used by:** Ops/deployment step, scheduled jobs.
