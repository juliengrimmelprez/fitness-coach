"""Upsert normalized Garmin data into Plate's Supabase tables.

Enabled when these environment variables are set (GitHub Actions secrets, or a local .env):
  SUPABASE_URL           https://<project>.supabase.co
  SUPABASE_SERVICE_KEY   service_role / secret key (bypasses RLS; never ship it to the app)
  PLATE_USER_ID          the Plate user these rows belong to (Supabase auth user id)
"""

import os
from typing import Any

import requests

DAILY_COLUMNS = [
    "sleep_min", "deep_sleep_min", "light_sleep_min", "rem_sleep_min", "awake_min", "sleep_score",
    "hrv_last_night_ms", "hrv_weekly_avg_ms", "hrv_status", "resting_hr", "avg_stress",
    "body_battery_high", "body_battery_low", "body_battery_charged", "body_battery_drained",
    "steps", "active_kcal", "total_kcal", "intensity_min_moderate", "intensity_min_vigorous", "vo2max",
]


def configured() -> bool:
    return all(os.getenv(k) for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "PLATE_USER_ID"))


def _upsert(table: str, rows: list[dict[str, Any]], on_conflict: str) -> None:
    if not rows:
        return
    key = os.environ["SUPABASE_SERVICE_KEY"]
    response = requests.post(
        f"{os.environ['SUPABASE_URL'].rstrip('/')}/rest/v1/{table}",
        params={"on_conflict": on_conflict},
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=rows,
        timeout=30,
    )
    if not response.ok:
        raise RuntimeError(f"Supabase upsert into {table} failed: {response.status_code} {response.text[:300]}")


def upload(days: list[dict[str, Any]], activities: list[dict[str, Any]]) -> None:
    user_id = os.environ["PLATE_USER_ID"]

    # Skip days with no data at all (e.g. watch not synced yet) so they don't overwrite with blanks.
    daily_rows = [
        {"user_id": user_id, "date": d["date"], **{c: d.get(c) for c in DAILY_COLUMNS}}
        for d in days
        if any(d.get(c) is not None for c in DAILY_COLUMNS)
    ]
    activity_rows = [
        {
            "id": a["id"],
            "user_id": user_id,
            "name": a["name"],
            "type": a["type"],
            "start_local": a["start_local"],
            "local_date": (a["start_local"] or "")[:10],
            "duration_min": a["duration_min"],
            "distance_km": a["distance_km"],
            "pace_s_per_km": a["pace_s_per_km"],
            "avg_hr": a["avg_hr"],
            "max_hr": a["max_hr"],
            "calories": a["calories"],
            "aerobic_te": a["aerobic_te"],
            "anaerobic_te": a["anaerobic_te"],
            "training_load": a["training_load"],
            "elevation_gain_m": a["elevation_gain_m"],
            "strength_sets": a["strength_sets"],
        }
        for a in activities
        if a.get("id") and a.get("start_local")
    ]

    _upsert("garmin_daily", daily_rows, "user_id,date")
    _upsert("garmin_activities", activity_rows, "id")
    print(f"Uploaded to Supabase: {len(daily_rows)} days, {len(activity_rows)} activities")
