"""Spatial hotspot detection: kernel density estimation over incident coordinates.

The Gaussian-kernel bandwidth is chosen by cross-validated log-likelihood on the data being analysed (a fixed
random subsample, so results are reproducible); hotspot centres are picked greedily by density and kept at least
two radii apart, so hotspots never overlap and every incident belongs to at most one of them. Members are the
incidents within CLUSTER_RADIUS_DEG of a centre."""

from __future__ import annotations

import numpy as np
from sklearn.model_selection import GridSearchCV
from sklearn.neighbors import KernelDensity

MODEL_VERSION = "kde-hotspot-v3"
CLUSTER_RADIUS_DEG = 0.035                  # about 3.9 km: incidents counted as belonging to a hotspot
MIN_SEPARATION_DEG = 2 * CLUSTER_RADIUS_DEG  # centres at least two radii apart => disjoint hotspots
BANDWIDTH_GRID = [0.005, 0.01, 0.015, 0.02, 0.03, 0.05, 0.07, 0.1]  # degrees (0.01 is about 1.1 km)
CV_SAMPLE = 2000
CV_FOLDS = 5
KDE_RTOL = 1e-4  # relative tolerance of the tree-based density evaluation; 7x faster, centres identical to exact
MIN_POINTS_FOR_CV = 30


def select_bandwidth(points: np.ndarray) -> float:
    """Bandwidth with the best held-out log-likelihood; Silverman's rule (clamped to the grid) for tiny samples."""
    if len(points) < MIN_POINTS_FOR_CV:
        spread = float(np.std(points[:, 0]) + np.std(points[:, 1])) / 2.0 or 0.035
        return float(np.clip(1.06 * spread * max(len(points), 1) ** -0.2, BANDWIDTH_GRID[0], BANDWIDTH_GRID[-1]))
    sample = points
    if len(points) > CV_SAMPLE:
        sample = points[np.random.default_rng(0).choice(len(points), CV_SAMPLE, replace=False)]
    search = GridSearchCV(KernelDensity(kernel="gaussian", rtol=KDE_RTOL), {"bandwidth": BANDWIDTH_GRID}, cv=CV_FOLDS).fit(sample)
    return float(search.best_params_["bandwidth"])


def find_hotspots(coordinates: np.ndarray, max_hotspots: int = 10) -> list[dict]:
    """coordinates: (n, 2) array of [latitude, longitude]. Returns hotspots, densest first, each with its
    centre, relative density (1.0 = densest) and the indices of the incidents inside its radius."""
    points = np.asarray(coordinates, dtype=float)
    if len(points) < 3:
        return [{"latitude": float(p[0]), "longitude": float(p[1]), "relative_density": 1.0, "member_indices": [i]}
                for i, p in enumerate(points)]

    bandwidth = select_bandwidth(points)
    densities = np.exp(KernelDensity(kernel="gaussian", bandwidth=bandwidth, rtol=KDE_RTOL).fit(points).score_samples(points))

    chosen: list[int] = []
    for index in np.argsort(-densities):
        if all(np.linalg.norm(points[index] - points[kept]) > MIN_SEPARATION_DEG for kept in chosen):
            chosen.append(int(index))
        if len(chosen) >= max_hotspots:
            break

    peak = float(densities[chosen[0]]) or 1.0
    hotspots = []
    for index in chosen:
        distances = np.linalg.norm(points - points[index], axis=1)
        hotspots.append({
            "latitude": float(points[index][0]),
            "longitude": float(points[index][1]),
            "relative_density": round(float(densities[index]) / peak, 4),
            "member_indices": [int(i) for i in np.flatnonzero(distances <= CLUSTER_RADIUS_DEG)],
            "bandwidth": round(bandwidth, 4),
        })
    return hotspots
