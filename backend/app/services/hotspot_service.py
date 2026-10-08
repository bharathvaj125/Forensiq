"""Map data for the GIS views, computed from the caller's geocoded cases: KDE hotspots and the layers
(districts, stations, crime types) that the filters and markers are built from."""

from __future__ import annotations

from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from app.models.user import User
from app.services import ai_audit_service, analytics, reference_data


def _scoped_frame(db: Session, current_user: User, **filters) -> pd.DataFrame:
    """Jurisdiction-scoped cases, excluding registrations dated after today (they are not real incidents yet)."""
    frame = analytics.load_cases(db, current_user, **filters)
    return frame[frame["registered"] <= pd.Timestamp(analytics.as_of_date(db))]


def _geocoded(frame: pd.DataFrame) -> pd.DataFrame:
    return frame[frame["lat"].notna() & (frame["lat"] != 0) & (frame["lon"] != 0)]


def get_predicted_hotspots(db: Session, current_user: User, district_id: Optional[int] = None,
                           station_id: Optional[int] = None, crime_category: Optional[str] = None) -> dict:
    frame = _scoped_frame(db, current_user, district_id=district_id, station_id=station_id, crime_category=crime_category)
    hotspots = analytics.compute_hotspots(db, frame, limit=25)

    result = {
        "model_version": analytics.HOTSPOT_MODEL_VERSION,
        "as_of_date": analytics.as_of_date(db).isoformat(),
        "hotspots": [{
            "rank": h["rank"], "latitude": h["latitude"], "longitude": h["longitude"], "relative_density": h["relative_density"],
            "radius_m": h["radius_m"], "location_name": h["location_name"], "district_name": h["district_name"],
            "case_count": h["case_count"], "open_cases": h["open_cases"], "high_risk_cases": h["high_risk_cases"],
            "high_risk_lift": h["high_risk_lift"], "repeat_offender_profiles": h["repeat_offender_profiles"],
            "top_crimes": [{"name": name, "cases": count} for name, count in h["top_crimes"]],
            "peak_window": analytics.window_label(h["peak_window"]), "risk_level": h["risk_level"], "reason": h["reason"],
            "top_factors": [
                f"{h['case_count']} FIRs within about {h['radius_m'] / 1000:.1f} km ({h['open_cases']} still open)",
                f"{h['high_risk_cases']} rated High/Severe ({h['high_risk_lift']}x the average share)",
                *[f"{name}: {count} FIRs" for name, count in h["top_crimes"]],
                *([f"Most incidents between {analytics.window_label(h['peak_window'])}"] if h["peak_window"] else []),
            ],
        } for h in hotspots],
    }
    if not hotspots:
        result["warning"] = "No geocoded cases in the caller's jurisdiction and filters."
    ai_audit_service.log_ai_run(db, current_user.UserID, "hotspot_prediction", "kernel_density", result["model_version"],
                                None, {"hotspot_count": len(hotspots)})
    return result


def get_map_layers(db: Session, current_user: User) -> dict:
    """Everything the map screens used to hardcode: where districts and stations are (the median coordinate of the
    FIRs they registered, since the dataset holds no station coordinates), and which crime types exist."""
    frame = _scoped_frame(db, current_user)
    geocoded = _geocoded(frame)
    district_names = reference_data.district_names(db)
    station_names = reference_data.station_names(db)
    crime_names = reference_data.crime_head_names(db)

    def centres(column: str, names: dict[int, str]) -> list[dict]:
        rows = []
        for key, group in geocoded[geocoded[column].notna()].groupby(column):
            rows.append({"id": int(key), "name": names.get(int(key), f"#{int(key)}"), "latitude": float(group["lat"].median()),
                         "longitude": float(group["lon"].median()), "cases": int(len(group))})
        return sorted(rows, key=lambda row: row["name"])

    stations = centres("station_id", station_names)
    station_district = reference_data.station_districts(db)
    for station in stations:
        station["district_id"] = station_district.get(station["id"])

    crime_heads = [{"id": int(key), "name": crime_names.get(int(key), f"#{int(key)}"), "cases": int(count)}
                   for key, count in frame["head_id"].dropna().astype(int).value_counts().items()]
    crime_heads.sort(key=lambda row: row["name"])

    bounds = None
    if len(geocoded):
        bounds = [[float(geocoded["lat"].min()), float(geocoded["lon"].min())], [float(geocoded["lat"].max()), float(geocoded["lon"].max())]]
    return {"as_of_date": analytics.as_of_date(db).isoformat(), "geocoded_cases": int(len(geocoded)), "bounds": bounds,
            "districts": centres("district_id", district_names), "stations": stations, "crime_heads": crime_heads}
