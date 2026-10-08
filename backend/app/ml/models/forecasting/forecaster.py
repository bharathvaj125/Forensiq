"""Trend forecast of daily registrations by Ridge regression, with a significance test on the slope."""

from datetime import timedelta

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

MODEL_VERSION = "ridge-trend-v3"
SIGNIFICANCE_T = 2.0  # |t| above this is a significant slope (about the 95% level for the sample sizes involved)
MIN_DAYS = 3


def forecast_crime_trend(registration_dates: list[str], horizon_days: int) -> dict:
    """Fit a linear trend to daily counts and extend it `horizon_days` days.

    Returns an empty forecast (trend 'insufficient data') when there are too few days to fit."""
    dates = pd.to_datetime(pd.Series(registration_dates), errors="coerce").dropna().dt.normalize()
    if dates.empty:
        return {"model_version": MODEL_VERSION, "trend": "insufficient data", "points": []}

    daily = dates.value_counts().sort_index()
    series = daily.reindex(pd.date_range(daily.index.min(), daily.index.max(), freq="D"), fill_value=0)
    n = len(series)
    if n < MIN_DAYS:
        return {"model_version": MODEL_VERSION, "trend": "insufficient data", "points": []}

    x = np.arange(n).reshape(-1, 1)
    y = series.values
    model = Ridge(alpha=1.0).fit(x, y)
    slope = float(model.coef_[0])
    predicted = model.predict(np.arange(n, n + horizon_days).reshape(-1, 1)).clip(min=0)

    residual_ss = float(np.sum((y - model.predict(x)) ** 2))
    spread_x = float(np.sum((x - x.mean()) ** 2))
    significant = False
    if n > 2 and residual_ss > 0 and spread_x > 0:
        standard_error = np.sqrt(residual_ss / (n - 2)) / np.sqrt(spread_x)
        significant = abs(slope / standard_error) > SIGNIFICANCE_T

    trend = ("increasing" if slope > 0 else "decreasing") if significant else "stable"
    return {
        "model_version": MODEL_VERSION,
        "trend": trend,
        "points": [
            {"date": (series.index.max() + timedelta(days=i + 1)).date().isoformat(), "predicted_count": round(float(value), 2)}
            for i, value in enumerate(predicted)
        ],
    }
