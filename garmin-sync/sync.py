"""Pull recent Garmin data and save it as JSON.

Usage:  python sync.py [days]      (default: 30)

Writes:
  data/raw/<date>/<endpoint>.json   untouched Garmin responses (for debugging the mapping)
  data/daily.json                   one cleaned-up record per day
  data/activities.json              one cleaned-up record per workout
"""

import json
import sys
import time
from datetime import date, timedelta
from typing import Any

from garminconnect import GarminConnectTooManyRequestsError

from common import DATA_DIR, connect

PAUSE_S = 0.4  # be polite to Garmin between calls

# Daily endpoints to pull: name -> method on the Garmin client taking a YYYY-MM-DD date.
DAILY_ENDPOINTS = {
    "stats": "get_stats",
    "sleep": "get_sleep_data",
    "hrv": "get_hrv_data",
    "max_metrics": "get_max_metrics",
    "training_readiness": "get_training_readiness",
}


def dig(obj: Any, *path: Any) -> Any:
    """Safely walk nested dicts/lists; returns None if any step is missing."""
    for key in path:
        if obj is None:
            return None
        if isinstance(key, int):
            obj = obj[key] if isinstance(obj, list) and len(obj) > key else None
        else:
            obj = obj.get(key) if isinstance(obj, dict) else None
    return obj


def fetch(client, method: str, *args) -> Any:
    try:
        result = getattr(client, method)(*args)
    except GarminConnectTooManyRequestsError:
        raise
    except Exception as err:  # one failing endpoint shouldn't stop the sync
        print(f"    ! {method}{args}: {type(err).__name__}: {err}")
        result = None
    time.sleep(PAUSE_S)
    return result


def save_json(path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")


def normalize_day(day: str, raw: dict[str, Any]) -> dict[str, Any]:
    stats, sleep, hrv = raw.get("stats"), raw.get("sleep"), raw.get("hrv")
    sleep_dto = dig(sleep, "dailySleepDTO")
    readiness = raw.get("training_readiness")
    if isinstance(readiness, list):
        readiness = readiness[0] if readiness else None

    def minutes(seconds):
        return round(seconds / 60) if isinstance(seconds, (int, float)) else None

    return {
        "date": day,
        # Sleep
        "sleep_min": minutes(dig(sleep_dto, "sleepTimeSeconds")),
        "deep_sleep_min": minutes(dig(sleep_dto, "deepSleepSeconds")),
        "light_sleep_min": minutes(dig(sleep_dto, "lightSleepSeconds")),
        "rem_sleep_min": minutes(dig(sleep_dto, "remSleepSeconds")),
        "awake_min": minutes(dig(sleep_dto, "awakeSleepSeconds")),
        "sleep_score": dig(sleep_dto, "sleepScores", "overall", "value"),
        # Recovery
        "hrv_last_night_ms": dig(hrv, "hrvSummary", "lastNightAvg"),
        "hrv_weekly_avg_ms": dig(hrv, "hrvSummary", "weeklyAvg"),
        "hrv_status": dig(hrv, "hrvSummary", "status"),
        "resting_hr": dig(stats, "restingHeartRate"),
        "avg_stress": dig(stats, "averageStressLevel"),
        "body_battery_high": dig(stats, "bodyBatteryHighestValue"),
        "body_battery_low": dig(stats, "bodyBatteryLowestValue"),
        "body_battery_charged": dig(stats, "bodyBatteryChargedValue"),
        "body_battery_drained": dig(stats, "bodyBatteryDrainedValue"),
        "garmin_readiness": dig(readiness, "score"),
        # Activity
        "steps": dig(stats, "totalSteps"),
        "active_kcal": dig(stats, "activeKilocalories"),
        "total_kcal": dig(stats, "totalKilocalories"),
        "intensity_min_moderate": dig(stats, "moderateIntensityMinutes"),
        "intensity_min_vigorous": dig(stats, "vigorousIntensityMinutes"),
        # Fitness
        "vo2max": dig(raw.get("max_metrics"), 0, "generic", "vo2MaxPreciseValue"),
    }


def normalize_activity(a: dict[str, Any], exercise_sets: Any) -> dict[str, Any]:
    distance_m = a.get("distance")
    duration_s = a.get("duration")
    pace = None
    if distance_m and duration_s and distance_m > 100:
        pace = round(duration_s / (distance_m / 1000))  # seconds per km

    sets = []
    for s in dig(exercise_sets, "exerciseSets") or []:
        if s.get("setType") != "ACTIVE":
            continue
        ex = dig(s, "exercises", 0) or {}
        sets.append({
            "exercise": ex.get("name") or ex.get("category"),
            "reps": s.get("repetitionCount"),
            "weight_kg": round(s["weight"] / 1000, 1) if s.get("weight") else None,
        })

    return {
        "id": a.get("activityId"),
        "name": a.get("activityName"),
        "type": dig(a, "activityType", "typeKey"),
        "start_local": a.get("startTimeLocal"),
        "duration_min": round(duration_s / 60, 1) if duration_s else None,
        "distance_km": round(distance_m / 1000, 2) if distance_m else None,
        "pace_s_per_km": pace,
        "avg_hr": a.get("averageHR"),
        "max_hr": a.get("maxHR"),
        "calories": a.get("calories"),
        "aerobic_te": a.get("aerobicTrainingEffect"),
        "anaerobic_te": a.get("anaerobicTrainingEffect"),
        "training_load": a.get("activityTrainingLoad"),
        "elevation_gain_m": a.get("elevationGain"),
        "strength_sets": sets or None,
    }


def coverage_report(days: list[dict], activities: list[dict]) -> None:
    print("\n=== What your watch gave us ===")
    fields = [k for k in days[0] if k != "date"] if days else []
    for field in fields:
        n = sum(1 for d in days if d.get(field) is not None)
        bar = "#" * round(20 * n / len(days))
        print(f"  {field:<24} {bar:<20} {n}/{len(days)} days")

    print(f"\n=== {len(activities)} activities ===")
    by_type: dict[str, int] = {}
    for a in activities:
        by_type[a["type"]] = by_type.get(a["type"], 0) + 1
    for t, n in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  {t:<24} {n}")


def main() -> None:
    n_days = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    end = date.today()
    start = end - timedelta(days=n_days - 1)

    print("Connecting to Garmin...")
    client = connect()
    print(f"Pulling {start} -> {end} ({n_days} days)")

    days = []
    try:
        for i in range(n_days):
            day = (start + timedelta(days=i)).isoformat()
            print(f"  {day}")
            raw = {name: fetch(client, method, day) for name, method in DAILY_ENDPOINTS.items()}
            for name, data in raw.items():
                save_json(DATA_DIR / "raw" / day / f"{name}.json", data)
            days.append(normalize_day(day, raw))

        print("Pulling activities...")
        raw_activities = fetch(client, "get_activities_by_date", start.isoformat(), end.isoformat()) or []
        save_json(DATA_DIR / "raw" / "activities.json", raw_activities)

        activities = []
        for a in raw_activities:
            sets = None
            if dig(a, "activityType", "typeKey") == "strength_training":
                sets = fetch(client, "get_activity_exercise_sets", a["activityId"])
                save_json(DATA_DIR / "raw" / "exercise_sets" / f"{a['activityId']}.json", sets)
            activities.append(normalize_activity(a, sets))
    except GarminConnectTooManyRequestsError:
        sys.exit("Garmin is rate-limiting us. Wait ~15 minutes and try again with fewer days.")

    save_json(DATA_DIR / "daily.json", days)
    save_json(DATA_DIR / "activities.json", activities)
    coverage_report(days, activities)
    print(f"\nSaved to {DATA_DIR}")


if __name__ == "__main__":
    main()
