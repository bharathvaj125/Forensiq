"""
Training script for the Ridge regression trend forecasting model.
"""

import numpy as np
from sklearn.linear_model import Ridge

def train_forecasting_model() -> Ridge:
    """Train and return Ridge regression forecasting model."""
    np.random.seed(42)
    # Generate 180 days of daily crime counts with time trend
    x = np.arange(180).reshape(-1, 1)
    y = 5.0 + 0.05 * x.flatten() + np.random.normal(0, 1.2, size=180)
    
    model = Ridge(alpha=1.0)
    model.fit(x, y)
    return model
