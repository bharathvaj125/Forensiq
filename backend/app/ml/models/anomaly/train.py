"""
Training script for the IsolationForest anomaly detection model.
"""

import numpy as np
from sklearn.ensemble import IsolationForest

def train_anomaly_model() -> IsolationForest:
    """Train and return IsolationForest model over engineered case feature matrix."""
    np.random.seed(42)
    # Generate 500 synthetic cases: [log_delay, accused_count, evidence_count, evidence_accused_ratio]
    delays = np.random.exponential(scale=24.0, size=500)
    accused = np.random.poisson(lam=1.5, size=500) + 1
    evidence = np.random.poisson(lam=3.0, size=500)
    
    log_delay = np.log1p(delays)
    ratio = evidence / (accused + 1.0)
    
    X = np.column_stack([log_delay, accused, evidence, ratio])
    
    model = IsolationForest(contamination="auto", random_state=42)
    model.fit(X)
    return model
