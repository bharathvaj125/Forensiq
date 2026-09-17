import numpy as np
from sklearn.neighbors import KernelDensity
from functools import lru_cache

@lru_cache(maxsize=1)
def _get_hotspot_model():
    """Load serialized KDE spatial hotspot model. Fail-fast if absent."""
    import joblib
    from pathlib import Path
    model_path = Path(__file__).parents[2] / "saved_models" / "hotspot_model.joblib"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Required ML artifact 'hotspot_model.joblib' is missing from {model_path.parent}. "
            f"Run 'python train_and_save_all_models.py' before deploying to Catalyst AppSail."
        )
    return joblib.load(model_path)


CRIME_HEAD_LABELS = {
    1: "Armed Assault & Violent Crime",
    2: "Night Burglary & Vehicle Theft",
    3: "Crimes Against Women & Harassment",
    4: "Child Protection & POCSO Violations",
    7: "Cyber Financial Extortion & Online Fraud",
    8: "NDPS Narcotics & Contraband",
    9: "Public Order & State Security Offences",
    11: "Public Nuisance & Domestic Harassment",
    13: "Excise Violation & Illegal Liquor Transit",
}


def predict_hotspots(cases: list[dict], max_hotspots: int = 25) -> list[dict]:
    """Return representative high-density hotspot points and calibrated scores with real database risk factors."""
    points = []
    case_objects = []
    for case in cases:
        lat = case.get("latitude")
        lon = case.get("longitude")
        if lat is not None and lon is not None:
            try:
                flat = float(lat)
                flon = float(lon)
                points.append([flat, flon])
                case_objects.append(case)
            except (ValueError, TypeError):
                continue

    coordinates = np.asarray(points, dtype=float)
    if len(coordinates) < 3:
        return [
            {
                "latitude": float(point[0]),
                "longitude": float(point[1]),
                "confidence": 0.5,
                "top_factors": ["Insufficient history; displaying observed incident location."]
            }
            for point in coordinates
        ]

    # Silverman's Rule of Thumb for Kernel Density Bandwidth Selection
    std_lat = np.std(coordinates[:, 0])
    std_lon = np.std(coordinates[:, 1])
    std_avg = float(std_lat + std_lon) / 2.0
    if std_avg <= 0.0:
        std_avg = 0.035

    n = len(coordinates)
    bandwidth = 1.06 * std_avg * (n ** -0.2)
    bandwidth = max(0.005, min(0.1, bandwidth))

    model = KernelDensity(kernel="gaussian", bandwidth=bandwidth).fit(coordinates)
    log_densities = model.score_samples(coordinates)
    densities = np.exp(log_densities)

    # Ranked spatial grid merging (cluster aggregation)
    ranking = np.argsort(densities)[::-1]
    selected: list[int] = []
    grid_threshold = 0.02  # Approximately 2.2km grid boundaries

    for index in ranking:
        pt = coordinates[index]
        if all(np.linalg.norm(pt - coordinates[kept]) > grid_threshold for kept in selected):
            selected.append(int(index))
        if len(selected) >= max_hotspots:
            break

    max_density = float(densities[ranking[0]])
    if max_density == 0.0:
        max_density = 1.0

    hotspots = []
    for index in selected:
        pt = coordinates[index]
        # Calculate cluster crime statistics from nearby cases in database (radius ~0.035 deg ~ 3.5km)
        nearby_cases = [
            c for c in case_objects
            if c.get("latitude") is not None and c.get("longitude") is not None and np.sqrt((float(c["latitude"]) - pt[0])**2 + (float(c["longitude"]) - pt[1])**2) <= 0.035
        ]
        
        crime_counts = {}
        for c in nearby_cases:
            head_id = c.get("crime_major_head_id") or 2
            crime_counts[head_id] = crime_counts.get(head_id, 0) + 1
        
        sorted_crimes = sorted(crime_counts.items(), key=lambda x: x[1], reverse=True)
        
        top_factors = []
        if sorted_crimes:
            top_head, top_cnt = sorted_crimes[0]
            top_label = CRIME_HEAD_LABELS.get(top_head, "Property & General Crime")
            top_factors.append(f"Primary Crime Driver: {top_label} ({top_cnt} FIRs)")
            
            if len(sorted_crimes) > 1:
                sec_head, sec_cnt = sorted_crimes[1]
                sec_label = CRIME_HEAD_LABELS.get(sec_head, "Subordinate Offence Category")
                top_factors.append(f"Secondary Risk Factor: {sec_label} ({sec_cnt} FIRs)")
            else:
                top_factors.append(f"Spatially recurring crime density peak ({len(nearby_cases)} total FIRs)")
        else:
            top_factors = ["High spatial incident density", f"KDE spatial bandwidth: {round(bandwidth, 4)}"]

        hotspots.append({
            "latitude": float(pt[0]),
            "longitude": float(pt[1]),
            "confidence": round(float(densities[index] / max_density), 4),
            "top_factors": top_factors
        })

    return hotspots
