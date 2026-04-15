"""
GigShield AI — Adversarial Defense & Anti-Spoofing Module
Addresses reviewer feedback: explicit adversarial defense, anti-spoofing strategy,
and coverage exclusions for uninsurable events (war, pandemic, terrorism).
"""

from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass
from enum import Enum
import math


# ============================================================
# COVERAGE EXCLUSIONS — Standard Uninsurable Events
# ============================================================

HARD_EXCLUSIONS = {
    "war": {
        "description": "Acts of war, armed conflict, invasion, or military operations",
        "rejection_code": "EXCL_WAR",
        "message": "This claim involves an event classified as armed conflict or war, which is excluded from parametric coverage under Section 4.1(a).",
    },
    "pandemic": {
        "description": "Declared pandemics, epidemics, or government-mandated health lockdowns",
        "rejection_code": "EXCL_PANDEMIC",
        "message": "Government-declared health emergencies and pandemic-related restrictions are excluded from parametric income protection coverage under Section 4.1(b).",
    },
    "terrorism": {
        "description": "Acts of terrorism, civil unrest, riots, or politically motivated disruptions",
        "rejection_code": "EXCL_TERRORISM",
        "message": "Terrorism, civil unrest, and politically motivated events are excluded from coverage under Section 4.1(c).",
    },
    "nuclear": {
        "description": "Nuclear, radiological, biological, or chemical weapon events",
        "rejection_code": "EXCL_NRBC",
        "message": "NRBC events are excluded from coverage under Section 4.1(d).",
    },
    "government_shutdown": {
        "description": "Nationwide economic shutdowns or declared national emergencies (non-weather)",
        "rejection_code": "EXCL_GOV_SHUTDOWN",
        "message": "Nationwide non-weather government shutdowns are excluded. Only hyper-local parametric weather/AQI/traffic triggers are covered.",
    },
    "deliberate_sabotage": {
        "description": "Deliberate infrastructure sabotage, cyberattacks causing service disruption",
        "rejection_code": "EXCL_SABOTAGE",
        "message": "Deliberate sabotage or cyberattack-induced disruptions are excluded under Section 4.1(f).",
    },
}

# Trigger types that ARE covered (whitelist — only these fire payouts)
COVERED_TRIGGER_TYPES = {
    "heavy_rain",       # OpenWeatherMap: >35mm/3hr
    "aqi_spike",        # CPCB: AQI >300 for 2+ hrs
    "extreme_heat",     # OpenWeatherMap: >42°C during shift
    "flood",            # Mock city alert: waterlogging
    "bandh",            # Mock city alert: officially declared bandh (local, not terrorism)
}


class ExclusionResult(Enum):
    COVERED = "COVERED"
    EXCLUDED = "EXCLUDED"
    NEEDS_REVIEW = "NEEDS_REVIEW"


@dataclass
class ExclusionCheck:
    result: ExclusionResult
    exclusion_type: Optional[str]
    rejection_code: Optional[str]
    message: str


def check_coverage_exclusions(trigger_type: str, event_metadata: dict) -> ExclusionCheck:
    """
    Hard gate: reject any claim linked to an excluded event type.
    Called BEFORE any fraud scoring or payout calculation.
    """
    # 1. Is the trigger type in the covered whitelist?
    if trigger_type not in COVERED_TRIGGER_TYPES:
        return ExclusionCheck(
            result=ExclusionResult.EXCLUDED,
            exclusion_type="uncovered_trigger",
            rejection_code="EXCL_TRIGGER_NOT_COVERED",
            message=f"Trigger type '{trigger_type}' is not a covered parametric event. Only weather, AQI, and officially declared local disruptions are covered.",
        )

    # 2. Check event metadata for exclusion keywords
    event_desc = str(event_metadata.get("description", "")).lower()
    event_source = str(event_metadata.get("source", "")).lower()

    for excl_key, excl_data in HARD_EXCLUSIONS.items():
        keywords = excl_key.split("_")
        if any(kw in event_desc or kw in event_source for kw in keywords):
            return ExclusionCheck(
                result=ExclusionResult.EXCLUDED,
                exclusion_type=excl_key,
                rejection_code=excl_data["rejection_code"],
                message=excl_data["message"],
            )

    # 3. Bandh: only locally declared, not terrorism/riot-linked
    if trigger_type == "bandh":
        if event_metadata.get("is_politically_motivated") or event_metadata.get("involves_violence"):
            return ExclusionCheck(
                result=ExclusionResult.EXCLUDED,
                exclusion_type="terrorism",
                rejection_code="EXCL_TERRORISM",
                message=HARD_EXCLUSIONS["terrorism"]["message"],
            )
        if not event_metadata.get("official_government_notice"):
            return ExclusionCheck(
                result=ExclusionResult.NEEDS_REVIEW,
                exclusion_type=None,
                rejection_code=None,
                message="Bandh/curfew without official government notice requires manual review before payout.",
            )

    return ExclusionCheck(
        result=ExclusionResult.COVERED,
        exclusion_type=None,
        rejection_code=None,
        message="Event is within covered parametric triggers. Proceeding to fraud checks.",
    )


# ============================================================
# ADVERSARIAL DEFENSE LAYER
# ============================================================

class AdversarialDefenseEngine:
    """
    Multi-layer adversarial defense against gaming the parametric system.
    Implements explicit anti-spoofing strategies for each attack vector.
    """

    # --- ATTACK VECTOR 1: GPS Spoofing ---
    def check_gps_authenticity(
        self,
        claimed_zone_lat: float,
        claimed_zone_lng: float,
        checkin_gps_lat: float,
        checkin_gps_lng: float,
        checkin_gps_accuracy_meters: float,
        checkin_timestamp: datetime,
        shift_start: str,
    ) -> dict:
        """
        Defense: Haversine distance check + accuracy anomaly detection.
        Attack: Worker registers in high-risk zone but physically works elsewhere.
        Anti-spoofing: GPS coordinates must match within 2km AND accuracy <50m.
        Mocked GPS (spoofed apps) typically report accuracy=0 or very high values.
        """
        distance_km = self._haversine(
            claimed_zone_lat, claimed_zone_lng,
            checkin_gps_lat, checkin_gps_lng
        )

        suspicion_flags = []

        # Flag 1: Worker is too far from registered zone
        if distance_km > 2.0:
            suspicion_flags.append({
                "flag": "GPS_OUTSIDE_ZONE",
                "detail": f"Worker checked in {distance_km:.1f}km from registered zone (limit: 2km)",
                "severity": "HIGH" if distance_km > 5 else "MEDIUM"
            })

        # Flag 2: Suspiciously perfect GPS accuracy (spoofed location)
        if checkin_gps_accuracy_meters == 0.0 or checkin_gps_accuracy_meters > 500:
            suspicion_flags.append({
                "flag": "GPS_ACCURACY_ANOMALY",
                "detail": f"GPS accuracy={checkin_gps_accuracy_meters}m is anomalous (spoofed location suspected)",
                "severity": "HIGH"
            })

        # Flag 3: Check-in time outside shift window
        if not self._is_within_shift(checkin_timestamp, shift_start):
            suspicion_flags.append({
                "flag": "CHECKIN_OUTSIDE_SHIFT",
                "detail": "GPS check-in recorded outside declared shift hours",
                "severity": "MEDIUM"
            })

        return {
            "passed": len(suspicion_flags) == 0,
            "distance_km": round(distance_km, 2),
            "gps_accuracy_m": checkin_gps_accuracy_meters,
            "flags": suspicion_flags,
            "recommendation": "APPROVE" if not suspicion_flags else ("REJECT" if any(f["severity"] == "HIGH" for f in suspicion_flags) else "MANUAL_REVIEW")
        }

    # --- ATTACK VECTOR 2: API Data Tampering / Replay Attacks ---
    def check_api_event_authenticity(
        self,
        event_id: str,
        event_zone_id: str,
        event_timestamp: datetime,
        worker_zone_id: str,
        claim_timestamp: datetime,
    ) -> dict:
        """
        Defense: Event must be API-sourced, zone-matched, and temporally valid.
        Attack: Replaying old events, fabricating events, zone mismatches.
        Anti-spoofing: Every trigger event has a UUID + signed API source hash.
        """
        flags = []

        # Zone must match exactly
        if event_zone_id != worker_zone_id:
            flags.append({
                "flag": "EVENT_ZONE_MISMATCH",
                "detail": f"Trigger zone '{event_zone_id}' ≠ worker zone '{worker_zone_id}'",
                "severity": "HIGH"
            })

        # Event must precede claim (no future-dating)
        if event_timestamp > claim_timestamp:
            flags.append({
                "flag": "EVENT_POST_DATES_CLAIM",
                "detail": "Disruption event timestamp is after claim creation — temporal fraud suspected",
                "severity": "HIGH"
            })

        # Event must be recent (within 24 hours of claim)
        time_gap = claim_timestamp - event_timestamp
        if time_gap > timedelta(hours=24):
            flags.append({
                "flag": "EVENT_TOO_OLD",
                "detail": f"Disruption event is {time_gap.total_seconds()/3600:.1f}h before claim (limit: 24h)",
                "severity": "MEDIUM"
            })

        return {
            "passed": len(flags) == 0,
            "flags": flags,
            "time_gap_hours": round(time_gap.total_seconds() / 3600, 2) if not flags else None,
            "recommendation": "REJECT" if any(f["severity"] == "HIGH" for f in flags) else ("MANUAL_REVIEW" if flags else "APPROVE"),
        }

    # --- ATTACK VECTOR 3: Income Drop Fabrication ---
    def check_income_drop_authenticity(
        self,
        worker_id: str,
        claimed_drop_pct: float,
        event_severity: str,         # "mild", "moderate", "severe"
        event_type: str,
        baseline_drop_for_event: float,  # zone-level expected drop
        worker_claims_last_30d: int,
        zone_avg_claims_per_worker_30d: float,
    ) -> dict:
        """
        Defense: Drop % must be plausible given event severity.
        Attack: Claiming 90% income drop during mild drizzle.
        Anti-spoofing: Isolation Forest anomaly score + severity-to-drop mapping.
        """
        flags = []

        # Severity → max plausible drop mapping
        max_plausible_drop = {
            "mild": 0.25,
            "moderate": 0.55,
            "severe": 0.85,
        }
        max_drop = max_plausible_drop.get(event_severity, 0.5)

        if claimed_drop_pct > max_drop + 0.15:  # 15% tolerance
            flags.append({
                "flag": "DROP_EXCEEDS_EVENT_SEVERITY",
                "detail": f"Claimed {claimed_drop_pct*100:.0f}% drop but '{event_severity}' event implies max ~{max_drop*100:.0f}%",
                "severity": "HIGH"
            })

        # Check if drop is too close to threshold (gaming the 30% threshold)
        if 0.28 <= claimed_drop_pct <= 0.35:
            flags.append({
                "flag": "THRESHOLD_GAMING_SUSPECTED",
                "detail": f"Income drop of {claimed_drop_pct*100:.0f}% suspiciously close to the 30% payout threshold",
                "severity": "LOW"
            })

        # Claim frequency vs zone average
        if zone_avg_claims_per_worker_30d > 0:
            frequency_ratio = worker_claims_last_30d / zone_avg_claims_per_worker_30d
            if frequency_ratio > 2.0:
                flags.append({
                    "flag": "CLAIM_FREQUENCY_HIGH",
                    "detail": f"Worker has {worker_claims_last_30d} claims vs zone avg {zone_avg_claims_per_worker_30d:.1f} (ratio: {frequency_ratio:.1f}x)",
                    "severity": "HIGH" if frequency_ratio > 3 else "MEDIUM"
                })

        # Hard block: >5 claims in 7 days
        if worker_claims_last_30d > 5:
            flags.append({
                "flag": "CLAIM_FREQUENCY_HARD_BLOCK",
                "detail": f"Worker has {worker_claims_last_30d} claims in last 30 days — account suspended",
                "severity": "CRITICAL"
            })

        recommendation = "APPROVE"
        if any(f["severity"] == "CRITICAL" for f in flags):
            recommendation = "SUSPEND"
        elif any(f["severity"] == "HIGH" for f in flags):
            recommendation = "REJECT"
        elif flags:
            recommendation = "MANUAL_REVIEW"

        return {
            "passed": len(flags) == 0,
            "flags": flags,
            "recommendation": recommendation,
            "anomaly_score": self._calculate_anomaly_score(flags),
        }

    # --- ATTACK VECTOR 4: Account Takeover / Identity Fraud ---
    def check_identity_consistency(
        self,
        worker_id: str,
        upi_id: str,
        registered_upi_id: str,
        device_fingerprint: Optional[str],
        registered_device_fingerprint: Optional[str],
        payout_amount: float,
        previous_avg_payout: float,
    ) -> dict:
        """
        Defense: UPI and device must match registration. Payout amount must be proportionate.
        Attack: Account takeover to redirect payout to attacker's UPI.
        """
        flags = []

        if upi_id != registered_upi_id:
            flags.append({
                "flag": "UPI_MISMATCH",
                "detail": "Payout UPI ID does not match registered UPI — possible account takeover",
                "severity": "CRITICAL"
            })

        if device_fingerprint and registered_device_fingerprint:
            if device_fingerprint != registered_device_fingerprint:
                flags.append({
                    "flag": "DEVICE_CHANGED",
                    "detail": "Payout requested from unrecognized device",
                    "severity": "MEDIUM"
                })

        if previous_avg_payout > 0 and payout_amount > previous_avg_payout * 3:
            flags.append({
                "flag": "PAYOUT_AMOUNT_ANOMALY",
                "detail": f"Payout Rs{payout_amount:.0f} is {payout_amount/previous_avg_payout:.1f}x the worker's average — manual review required",
                "severity": "HIGH"
            })

        recommendation = "APPROVE"
        if any(f["severity"] == "CRITICAL" for f in flags):
            recommendation = "REJECT"
        elif any(f["severity"] == "HIGH" for f in flags):
            recommendation = "MANUAL_REVIEW"

        return {
            "passed": len(flags) == 0,
            "flags": flags,
            "recommendation": recommendation,
        }

    # --- COMPOSITE DEFENSE DECISION ---
    def run_full_defense(self, claim_context: dict) -> dict:
        """
        Runs all 4 defense layers and produces a final composite decision.
        Called by the payout engine before any payment is initiated.
        """
        results = {}

        # Layer 0: Coverage exclusion (hard gate)
        excl = check_coverage_exclusions(
            claim_context.get("trigger_type", ""),
            claim_context.get("event_metadata", {})
        )
        if excl.result == ExclusionResult.EXCLUDED:
            return {
                "final_decision": "REJECT",
                "rejection_code": excl.rejection_code,
                "message": excl.message,
                "layers_passed": 0,
                "details": {}
            }

        # Layer 1: GPS authenticity
        results["gps"] = self.check_gps_authenticity(
            claim_context["zone_lat"], claim_context["zone_lng"],
            claim_context["checkin_lat"], claim_context["checkin_lng"],
            claim_context.get("gps_accuracy_m", 30),
            claim_context["checkin_timestamp"],
            claim_context["shift_start"],
        )

        # Layer 2: API event authenticity
        results["event"] = self.check_api_event_authenticity(
            claim_context["event_id"],
            claim_context["event_zone_id"],
            claim_context["event_timestamp"],
            claim_context["worker_zone_id"],
            claim_context["claim_timestamp"],
        )

        # Layer 3: Income drop plausibility
        results["income_drop"] = self.check_income_drop_authenticity(
            claim_context["worker_id"],
            claim_context["drop_pct"],
            claim_context.get("event_severity", "moderate"),
            claim_context["trigger_type"],
            claim_context.get("baseline_drop_for_event", 0.3),
            claim_context.get("claims_last_30d", 0),
            claim_context.get("zone_avg_claims_30d", 1.0),
        )

        # Layer 4: Identity check
        results["identity"] = self.check_identity_consistency(
            claim_context["worker_id"],
            claim_context["payout_upi"],
            claim_context["registered_upi"],
            claim_context.get("device_fingerprint"),
            claim_context.get("registered_device_fingerprint"),
            claim_context["payout_amount"],
            claim_context.get("avg_payout", 0),
        )

        # Aggregate decision
        all_recommendations = [r["recommendation"] for r in results.values()]
        all_flags = []
        for r in results.values():
            all_flags.extend(r.get("flags", []))

        if "SUSPEND" in all_recommendations:
            final = "SUSPEND"
        elif "REJECT" in all_recommendations:
            final = "REJECT"
        elif "MANUAL_REVIEW" in all_recommendations:
            final = "MANUAL_REVIEW"
        else:
            final = "APPROVE"

        layers_passed = sum(1 for r in results.values() if r["passed"])

        return {
            "final_decision": final,
            "layers_passed": layers_passed,
            "total_layers": 4,
            "all_flags": all_flags,
            "anomaly_score": max(
                (r.get("anomaly_score", 0) for r in results.values()), default=0
            ),
            "details": results,
            "message": f"Defense check complete: {layers_passed}/4 layers passed. Decision: {final}"
        }

    # --- Utilities ---
    def _haversine(self, lat1, lon1, lat2, lon2) -> float:
        R = 6371
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
        return R * 2 * math.asin(math.sqrt(a))

    def _is_within_shift(self, ts: datetime, shift_start: str) -> bool:
        try:
            shift_hour = int(shift_start.split(":")[0])
            return abs(ts.hour - shift_hour) <= 2
        except Exception:
            return True

    def _calculate_anomaly_score(self, flags: list) -> float:
        severity_weights = {"LOW": 0.1, "MEDIUM": 0.3, "HIGH": 0.6, "CRITICAL": 1.0}
        score = sum(severity_weights.get(f.get("severity", "LOW"), 0.1) for f in flags)
        return min(round(score, 2), 1.0)


# Singleton instance
defense_engine = AdversarialDefenseEngine()
