from app.ml.premium_calculator import calculate_premium

def test_premium_basic():
    p = calculate_premium("swiggy", "mumbai", 8.0)
    assert p >= 20.0

def test_premium_minimum():
    p = calculate_premium("unknown", "unknown", 1.0)
    assert p == 20.0

def test_premium_high_risk():
    p1 = calculate_premium("rapido", "mumbai", 12.0, 0.4, 0.6)
    p2 = calculate_premium("urban_company", "pune", 4.0, 0.05, 0.1)
    assert p1 > p2
