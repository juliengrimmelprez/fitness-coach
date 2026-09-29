"""One-time interactive Garmin login.

Run this yourself in a terminal. It asks for your Garmin email, password and
(if enabled) your MFA code, then saves a login token to ~/.garminconnect.
Your password is never stored; later syncs use only the token.

Usage:  python login.py          try every login method
        python login.py --web    skip the mobile methods (use when they return 429)
"""

import getpass
import sys

from garminconnect import (
    Garmin,
    GarminConnectAuthenticationError,
    GarminConnectConnectionError,
    GarminConnectTooManyRequestsError,
)

from common import DEFAULT_TOKENSTORE

# The mobile endpoints are the first to get rate limited (429), and the widget flow
# depends on the same token exchange; --web goes straight to the browser-style portal login.
WEB_ONLY_SKIP = {"mobile+cffi", "mobile+requests", "widget+cffi"}


def main() -> None:
    web_only = "--web" in sys.argv[1:]
    email = input("Garmin email: ").strip()
    password = getpass.getpass("Garmin password (hidden): ")

    client = Garmin(
        email=email,
        password=password,
        prompt_mfa=lambda: input("MFA code from Garmin (email/app): ").strip(),
    )
    if web_only:
        client.client.skip_strategies = set(WEB_ONLY_SKIP)
        print("Using web login only (this takes ~20 seconds on purpose)...")

    try:
        client.login(DEFAULT_TOKENSTORE)
    except GarminConnectTooManyRequestsError:
        sys.exit("\nGarmin is rate-limiting logins from this network. Wait at least an hour, "
                 "don't retry in the meantime, then run: python login.py --web")
    except GarminConnectAuthenticationError as err:
        sys.exit(f"\nLogin refused: {err}\n"
                 "Check the password by signing in at connect.garmin.com in a browser. "
                 "If it works there, wait an hour and run: python login.py --web")
    except GarminConnectConnectionError as err:
        sys.exit(f"\nCouldn't complete login: {err}\nWait an hour, then run: python login.py --web")

    print(f"\nLogged in as {client.get_full_name()}. Token saved to {DEFAULT_TOKENSTORE}")
    print("You can now run: python sync.py 30")


if __name__ == "__main__":
    main()
