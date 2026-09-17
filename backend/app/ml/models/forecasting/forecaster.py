import pandas as pd
import numpy as np
from datetime import timedelta
from sklearn.linear_model import Ridge
from functools import lru_cache

@lru_cache(maxsize=1)
def _get_forecasting_model():
    """Load serialized Ridge forecasting model. Fail-fast if absent."""
    import joblib
    from pathlib import Path
    model_path = Path(__file__).parents[2] / "saved_models" / "forecasting_model.joblib"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Required ML artifact 'forecasting_model.joblib' is missing from {model_path.parent}. "
            f"Run 'python train_and_save_all_models.py' before deploying to Catalyst AppSail."
        )
    return joblib.load(model_path)


def forecast_crime_trend(registration_dates: list[str], horizon_days: int) -> dict:
    """
    Preprocess dates, handle missing dates, fit Ridge regression, and
    classify the trend using a statistical significance t-test.
    """
    if not registration_dates:
        return {"model_version": "phase4-trend-regression-v2", "trend": "stable", "points": []}

    dates = pd.to_datetime(pd.Series(registration_dates), errors="coerce").dropna().dt.normalize()
    if len(dates) < 2:
        today_dt = pd.Timestamp.now().normalize()
        points = [
            {"date": (today_dt + timedelta(days=i+1)).date().isoformat(), "predicted_count": 1.0}
            for i in range(min(horizon_days, 14))
        ]
        return {"model_version": "phase4-trend-regression-v2", "trend": "stable", "points": points}

    daily = dates.value_counts().sort_index()
    full_index = pd.date_range(daily.index.min(), daily.index.max(), freq="D")
    series = daily.reindex(full_index, fill_value=0)

    n = len(series)
    if n < 3:
        # Too little data to compute residuals, fallback to flat predictions
        slope = 0.0
        predicted_vals = [float(series.values[-1])] * horizon_days
        significant = False
    else:
        x = np.arange(n).reshape(-1, 1)
        y = series.values

        # Use Ridge regression to avoid overfitting
        model = Ridge(alpha=1.0).fit(x, y)
        slope = float(model.coef_[0])

        future_x = np.arange(n, n + horizon_days).reshape(-1, 1)
        predicted_vals = model.predict(future_x).clip(min=0)

        # Compute statistical significance of the slope
        residuals = y - model.predict(x)
        rss = np.sum(residuals**2)
        df = n - 2
        se_regression = np.sqrt(rss / df) if df > 0 else 0.0

        x_mean = np.mean(x)
        ss_x = np.sum((x - x_mean)**2)

        if se_regression > 0 and ss_x > 0:
            se_slope = se_regression / np.sqrt(ss_x)
            t_stat = slope / se_slope
            # 95% confidence threshold (critical t-value approx 2.0)
            significant = abs(t_stat) > 2.0
        else:
            significant = False

    if significant:
        trend = "increasing" if slope > 0.0 else "decreasing"
    else:
        trend = "stable"

    return {
        "model_version": "phase4-trend-regression-v2",
        "trend": trend,
        "points": [
            {
                "date": (series.index.max() + timedelta(days=index + 1)).date().isoformat(),
                "predicted_count": round(float(value), 2)
            }
            for index, value in enumerate(predicted_vals)
        ],
    }
