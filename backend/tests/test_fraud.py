from app.ml.fraud_detection import assess_fraud_risk

def test_no_fraud():
    result = assess_fraud_risk(1, 1, 1, 30, 200.0, 200.0)
    assert result["is_suspicious"] == False

def test_excessive_claims():
    result = assess_fraud_risk(2, 5, 1, 30, 200.0, 200.0)
    assert "excessive_claims_24h" in result["flags"]

def test_impossible_location():
    result = assess_fraud_risk(3, 1, 4, 30, 200.0, 200.0)
    assert "impossible_location_change" in result["flags"]

def test_new_account_claim():
    result = assess_fraud_risk(4, 1, 1, 0, 200.0, 200.0)
    assert "new_account_immediate_claim" in result["flags"]
