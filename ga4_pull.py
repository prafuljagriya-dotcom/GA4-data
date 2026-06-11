#!/usr/bin/env python3
"""
GA4 Data Pull — Storable SEO Team
Reads client GA4 property IDs from the Client_Mapping sheet, pulls yesterday's
(or a custom date range of) sessions/active_users/key_events, and appends the
results to the Daily_Performance sheet — all in one run.

Usage:
    python ga4_pull.py                          # pull yesterday for all clients
    python ga4_pull.py --start-date 2026-06-01  # pull a specific date
    python ga4_pull.py --start-date 2026-06-01 --end-date 2026-06-10  # date range
    python ga4_pull.py --dry-run                # print results without writing
    python ga4_pull.py --client "Flynn Avenue"  # pull a single client by name
"""

import os
import sys
import argparse
import logging
from datetime import date, timedelta

from dotenv import load_dotenv
from google.oauth2 import service_account
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import DateRange, Dimension, Metric, RunReportRequest
import gspread

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Google Sheets IDs ──────────────────────────────────────────────────────────
SPREADSHEET_ID      = os.getenv("SPREADSHEET_ID", "1Hh1SBKByqV_fK0p3UTxkwrdMrfW-P2jlYOduu9p0_Hk")
CLIENT_MAPPING_TAB  = "Client_Mapping"
PERFORMANCE_TAB     = "Daily_Performance"

# ── Auth scopes ────────────────────────────────────────────────────────────────
SCOPES = [
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/spreadsheets",
]


# ── Credentials ───────────────────────────────────────────────────────────────

def load_credentials() -> service_account.Credentials:
    key_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    if not os.path.exists(key_file):
        log.error(
            "Service account key not found at '%s'. "
            "Set GOOGLE_SERVICE_ACCOUNT_FILE in your .env file.",
            key_file,
        )
        sys.exit(1)
    return service_account.Credentials.from_service_account_file(key_file, scopes=SCOPES)


# ── Sheets helpers ─────────────────────────────────────────────────────────────

def get_clients(gc: gspread.Client, name_filter: str | None = None) -> list[dict]:
    """Return rows from Client_Mapping that have a Property ID."""
    sh      = gc.open_by_key(SPREADSHEET_ID)
    ws      = sh.worksheet(CLIENT_MAPPING_TAB)
    records = ws.get_all_records()

    clients = [r for r in records if str(r.get("Property ID", "")).strip()]
    if name_filter:
        clients = [c for c in clients if name_filter.lower() in c["Client Name"].lower()]

    return clients


def get_existing_dates(gc: gspread.Client, property_id: str) -> set[str]:
    """Return dates already in Daily_Performance for a given property (avoids duplicates)."""
    sh  = gc.open_by_key(SPREADSHEET_ID)
    ws  = sh.worksheet(PERFORMANCE_TAB)
    all_values = ws.get_all_values()

    if len(all_values) < 2:   # only header or empty
        return set()

    existing = set()
    for row in all_values[1:]:   # skip header
        if len(row) >= 2 and str(row[1]).strip() == str(property_id).strip():
            existing.add(str(row[0]).strip())
    return existing


def append_rows(gc: gspread.Client, rows: list[list]) -> None:
    sh = gc.open_by_key(SPREADSHEET_ID)
    ws = sh.worksheet(PERFORMANCE_TAB)
    ws.append_rows(rows, value_input_option="USER_ENTERED")


# ── GA4 data pull ─────────────────────────────────────────────────────────────

def pull_property(
    property_id: str,
    credentials: service_account.Credentials,
    start_date: str,
    end_date: str,
) -> list[dict]:
    """Pull sessions / active users / key events from one GA4 property."""
    ga_client = BetaAnalyticsDataClient(credentials=credentials)

    request = RunReportRequest(
        property=f"properties/{property_id}",
        dimensions=[Dimension(name="date")],
        metrics=[
            Metric(name="sessions"),
            Metric(name="activeUsers"),
            Metric(name="keyEvents"),        # GA4 equivalent of conversions
        ],
        date_ranges=[DateRange(start_date=start_date, end_date=end_date)],
    )
    response = ga_client.run_report(request)

    rows = []
    for row in response.rows:
        raw_date = row.dimension_values[0].value          # "20260610"
        fmt_date = f"{raw_date[:4]}-{raw_date[4:6]}-{raw_date[6:]}"
        rows.append({
            "date":         fmt_date,
            "property_id":  property_id,
            "sessions":     int(row.metric_values[0].value),
            "active_users": int(row.metric_values[1].value),
            "conversions":  int(row.metric_values[2].value),
        })
    return rows


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Pull GA4 data into Google Sheets")
    parser.add_argument("--start-date",  help="Start date YYYY-MM-DD (default: yesterday)")
    parser.add_argument("--end-date",    help="End date   YYYY-MM-DD (default: same as start)")
    parser.add_argument("--client",      help="Pull only clients whose name contains this string")
    parser.add_argument("--dry-run",     action="store_true", help="Print without writing to sheet")
    parser.add_argument("--no-dedup",    action="store_true", help="Skip duplicate-date check")
    args = parser.parse_args()

    yesterday   = (date.today() - timedelta(days=1)).isoformat()
    start_date  = args.start_date or yesterday
    end_date    = args.end_date   or start_date

    log.info("Date range: %s → %s", start_date, end_date)

    creds   = load_credentials()
    gc      = gspread.authorize(creds)
    clients = get_clients(gc, name_filter=args.client)

    if not clients:
        log.warning("No clients with GA4 Property IDs found in '%s' tab.", CLIENT_MAPPING_TAB)
        sys.exit(0)

    log.info("Processing %d client(s)…", len(clients))

    all_rows: list[list] = []
    errors:   list[dict] = []
    skipped              = 0

    for client in clients:
        name        = client["Client Name"]
        property_id = str(client["Property ID"]).strip()

        try:
            rows = pull_property(property_id, creds, start_date, end_date)

            if not args.no_dedup:
                existing = get_existing_dates(gc, property_id)
                before   = len(rows)
                rows     = [r for r in rows if r["date"] not in existing]
                skipped += before - len(rows)

            for r in rows:
                all_rows.append([
                    r["date"],
                    r["property_id"],
                    r["sessions"],
                    r["active_users"],
                    r["conversions"],
                ])

            log.info("  %-45s  property %-12s  %d new row(s)", name, property_id, len(rows))

        except Exception as exc:
            log.error("  FAILED  %-45s  property %-12s  %s", name, property_id, exc)
            errors.append({"client": name, "property_id": property_id, "error": str(exc)})

    # ── Write / report ─────────────────────────────────────────────────────────
    if args.dry_run:
        log.info("\nDRY RUN — %d row(s) would be written:", len(all_rows))
        header = ["Date", "Property ID", "Sessions", "Active Users", "Conversions"]
        print("  " + " | ".join(f"{h:<15}" for h in header))
        print("  " + "-" * 82)
        for row in all_rows:
            print("  " + " | ".join(f"{str(v):<15}" for v in row))
    else:
        if all_rows:
            append_rows(gc, all_rows)
            log.info("Wrote %d row(s) to '%s' tab.", len(all_rows), PERFORMANCE_TAB)
        else:
            log.info("Nothing new to write (all dates already present or no data returned).")

    if skipped:
        log.info("Skipped %d duplicate row(s) already in sheet.", skipped)

    if errors:
        log.warning("\n%d error(s) — these clients were skipped:", len(errors))
        for e in errors:
            log.warning("  %s (property %s): %s", e["client"], e["property_id"], e["error"])
        sys.exit(1)


if __name__ == "__main__":
    main()
