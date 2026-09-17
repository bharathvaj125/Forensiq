"""
Training script for the KernelDensity spatial hotspot model.
"""

import numpy as np
from sklearn.neighbors import KernelDensity

def train_hotspot_model() -> KernelDensity:
    """Train and return KernelDensity model over representative Karnataka spatial coordinates."""
    np.random.seed(42)
    # Generate 500 representative Karnataka spatial crime points
    lats = np.random.normal(loc=15.3173, scale=0.8, size=500)
    lons = np.random.normal(loc=75.7139, scale=0.8, size=500)
    coords = np.column_stack([lats, lons])
    
    kde = KernelDensity(kernel="gaussian", bandwidth=0.035)
    kde.fit(coords)
    return kde
