from sklearn.ensemble import IsolationForest
import numpy as np
from typing import List, Dict

_iso_model = IsolationForest(contamination=0.1, random_state=42)
_fitted = False

def fit_model(claim_vectors: List[List[float]]):
    global _fitted
    if len(claim_vectors) >= 10:
        _iso_model.fit(np.array(claim_vectors))
        _fitted = True

def assess_fraud_risk(worker_id: int, claims_last_24h: int,
                      unique_cities_last_24h: int, account_age_days: int,
                      claim_amount: float, avg_claim_amount: float) -> Dict:
    flags = []
    if claims_last_24h > 3:
        flags.append("excessive_claims_24h")
    if unique_cities_last_24h > 2:
        flags.append("impossible_location_change")
    if account_age_days < 1 and claims_last_24h > 0:
        flags.append("new_account_immediate_claim")

    ml_anomaly = False
    if _fitted:
        vector = np.array([[claims_last_24h, unique_cities_last_24h,
                            account_age_days, claim_amount, avg_claim_amount]])
        ml_anomaly = _iso_model.predict(vector)[0] == -1

    return {
        "worker_id": worker_id,
        "flags": flags,
        "ml_anomaly": ml_anomaly,
        "is_suspicious": len(flags) > 0 or ml_anomaly,
        "severity": "high" if len(flags) >= 2 or ml_anomaly else "medium" if flags else "none"
    }
