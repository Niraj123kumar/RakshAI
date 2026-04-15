import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
import pickle, os

PLATFORM_RISK = {"swiggy": 1.1, "zomato": 1.1, "ola": 1.2, "rapido": 1.3, "urban_company": 0.9}
CITY_RISK = {"mumbai": 1.4, "delhi": 1.3, "bangalore": 1.2, "chennai": 1.3, "kolkata": 1.2, "hyderabad": 1.1, "pune": 1.0, "other": 1.0}

def _generate_training_data(n=2000):
    np.random.seed(42)
    rows, labels = [], []
    for _ in range(n):
        plat = np.random.choice(list(PLATFORM_RISK.keys()))
        city = np.random.choice(list(CITY_RISK.keys()))
        hours = np.random.uniform(4, 14)
        disruption_freq = np.random.uniform(0.05, 0.4)
        income_volatility = np.random.uniform(0.1, 0.6)
        premium = (35 * PLATFORM_RISK[plat] * CITY_RISK[city]
                   * (1 + disruption_freq) * (1 + income_volatility * 0.5)
                   * (hours / 8))
        rows.append([PLATFORM_RISK[plat], CITY_RISK[city], hours, disruption_freq, income_volatility])
        labels.append(round(premium, 2))
    return np.array(rows), np.array(labels)

def train_and_get_model():
    model_path = "/tmp/premium_model.pkl"
    if os.path.exists(model_path):
        with open(model_path, "rb") as f:
            return pickle.load(f)
    X, y = _generate_training_data()
    model = GradientBoostingRegressor(n_estimators=100, max_depth=4, random_state=42)
    model.fit(X, y)
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    return model

_model = train_and_get_model()

def calculate_premium(platform: str, city: str, avg_daily_hours: float,
                      disruption_freq: float = 0.2, income_volatility: float = 0.3) -> float:
    plat_risk = PLATFORM_RISK.get(platform.lower(), 1.0)
    city_risk = CITY_RISK.get(city.lower(), 1.0)
    features = np.array([[plat_risk, city_risk, avg_daily_hours, disruption_freq, income_volatility]])
    premium = _model.predict(features)[0]
    return round(max(premium, 20.0), 2)
