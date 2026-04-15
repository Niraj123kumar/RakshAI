from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models import Base, Worker, Zone, Policy
import json
from datetime import datetime

DATABASE_URL = "postgresql://nirajkumar@localhost/gigshield"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

# Seed zones
zones = [
    Zone(city="Bengaluru", name="HSR Layout", disruption_matrix={"rain_30mm": 0.65, "rain_45mm": 0.35, "aqi_300": 0.45, "heat_42": 0.12, "flood": 0.08, "bandh": 0.04}, income_impact_matrix={"rain_30mm": 0.22, "rain_45mm": 0.38, "aqi_300": 0.31}, last_updated=datetime.now()),
    Zone(city="Bengaluru", name="Koramangala", disruption_matrix={"rain_30mm": 0.60, "rain_45mm": 0.30, "aqi_300": 0.40, "heat_42": 0.10, "flood": 0.06, "bandh": 0.03}, income_impact_matrix={"rain_30mm": 0.20, "rain_45mm": 0.35, "aqi_300": 0.28}, last_updated=datetime.now()),
    Zone(city="Bengaluru", name="Indiranagar", disruption_matrix={"rain_30mm": 0.55, "rain_45mm": 0.25, "aqi_300": 0.35, "heat_42": 0.08, "flood": 0.05, "bandh": 0.02}, income_impact_matrix={"rain_30mm": 0.18, "rain_45mm": 0.30, "aqi_300": 0.25}, last_updated=datetime.now()),
    Zone(city="Delhi", name="Lajpat Nagar", disruption_matrix={"rain_30mm": 0.50, "rain_45mm": 0.20, "aqi_300": 0.75, "heat_42": 0.30, "flood": 0.04, "bandh": 0.08}, income_impact_matrix={"rain_30mm": 0.18, "rain_45mm": 0.32, "aqi_300": 0.40}, last_updated=datetime.now()),
    Zone(city="Delhi", name="GK1", disruption_matrix={"rain_30mm": 0.45, "rain_45mm": 0.18, "aqi_300": 0.70, "heat_42": 0.28, "flood": 0.03, "bandh": 0.07}, income_impact_matrix={"rain_30mm": 0.16, "rain_45mm": 0.30, "aqi_300": 0.38}, last_updated=datetime.now()),
]
db.add_all(zones)
db.commit()

# Seed workers
workers = [
    Worker(name="Rajan Kumar", phone="9876543210", upi_id="rajan@upi", city="Bengaluru", zone_geojson={"zone": "HSR Layout"}, platform="zepto", shift_start=datetime(2024,1,1,6,0), shift_end=datetime(2024,1,1,22,0), weekly_income_estimate=3500),
    Worker(name="Amit Singh", phone="9876543211", upi_id="amit@upi", city="Bengaluru", zone_geojson={"zone": "Koramangala"}, platform="blinkit", shift_start=datetime(2024,1,1,8,0), shift_end=datetime(2024,1,1,20,0), weekly_income_estimate=4000),
    Worker(name="Priya Sharma", phone="9876543212", upi_id="priya@upi", city="Delhi", zone_geojson={"zone": "Lajpat Nagar"}, platform="zepto", shift_start=datetime(2024,1,1,7,0), shift_end=datetime(2024,1,1,21,0), weekly_income_estimate=3000),
]
db.add_all(workers)
db.commit()

# Seed policies
policies = [
    Policy(worker_id=1, plan_type="Standard", status="active", weekly_premium=75, max_payout=900, start_date=datetime(2024,1,1), risk_score=74),
    Policy(worker_id=2, plan_type="Pro", status="active", weekly_premium=100, max_payout=1500, start_date=datetime(2024,1,1), risk_score=82),
    Policy(worker_id=3, plan_type="Basic", status="active", weekly_premium=50, max_payout=500, start_date=datetime(2024,1,1), risk_score=65),
]
db.add_all(policies)
db.commit()

print("✅ Seed data inserted successfully")
db.close()
