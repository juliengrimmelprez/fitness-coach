"""Shared helpers for the Garmin sync scripts."""

import os
from pathlib import Path

from dotenv import load_dotenv
from garminconnect import Garmin, GarminConnectAuthenticationError

# Tokens live in the user's home folder, NOT in the project (which syncs to OneDrive).
# They grant full access to the Garmin account, so they must never be committed or synced.
# On GitHub Actions, GARMINTOKENS holds the token JSON instead of a path.
DEFAULT_TOKENSTORE = str(Path.home() / ".garminconnect")

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"

# Local runs can keep Supabase settings in garmin-sync/.env (gitignored); GitHub Actions uses secrets.
load_dotenv(PROJECT_DIR / ".env")


def tokenstore() -> str:
    return os.getenv("GARMINTOKENS") or DEFAULT_TOKENSTORE


def connect() -> Garmin:
    """Log in with saved tokens only. Run login.py first if this fails."""
    client = Garmin()
    try:
        client.login(tokenstore())
    except GarminConnectAuthenticationError as err:
        raise SystemExit(f"No valid Garmin login ({err}). Run `python login.py` first.") from err
    return client
