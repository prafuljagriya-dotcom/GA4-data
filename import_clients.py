#!/usr/bin/env python3
"""
Import client list into the Client_Mapping sheet.

Two modes:
  1. From a CSV file:   python import_clients.py --csv clients.csv
  2. Interactive:       python import_clients.py --interactive

CSV format (first row = header):
    Property ID,Client Name,Account Manager,Tier,Storage Type

Example CSV row:
    123456789,Flynn Avenue Self Storage,Praful,Tier 3,Self Storage
"""

import os
import sys
import csv
import argparse

from dotenv import load_dotenv
from google.oauth2 import service_account
import gspread

load_dotenv()

SPREADSHEET_ID     = os.getenv("SPREADSHEET_ID", "1Hh1SBKByqV_fK0p3UTxkwrdMrfW-P2jlYOduu9p0_Hk")
CLIENT_MAPPING_TAB = "Client_Mapping"
SCOPES             = [
    "https://www.googleapis.com/auth/spreadsheets",
]

TIERS          = ["Legacy", "Tier 1", "Tier 2", "Tier 3"]
STORAGE_TYPES  = ["Self Storage", "RV Storage", "Boat Storage", "Mixed", "Other"]


def load_credentials():
    key_file = os.getenv("GOOGLE_SERVICE_ACCOUNT_FILE", "service_account.json")
    if not os.path.exists(key_file):
        print(f"ERROR: Service account key not found at '{key_file}'.")
        sys.exit(1)
    return service_account.Credentials.from_service_account_file(key_file, scopes=SCOPES)


def get_worksheet():
    creds = load_credentials()
    gc    = gspread.authorize(creds)
    sh    = gc.open_by_key(SPREADSHEET_ID)
    return sh.worksheet(CLIENT_MAPPING_TAB)


def existing_property_ids(ws) -> set:
    records = ws.get_all_records()
    return {str(r.get("Property ID", "")).strip() for r in records if r.get("Property ID")}


def import_from_csv(csv_path: str) -> None:
    ws       = get_worksheet()
    existing = existing_property_ids(ws)
    new_rows = []
    skipped  = 0

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            pid = str(row.get("Property ID", "")).strip()
            if not pid:
                continue
            if pid in existing:
                skipped += 1
                continue
            new_rows.append([
                pid,
                row.get("Client Name", "").strip(),
                row.get("Account Manager", "").strip(),
                row.get("Tier", "").strip(),
                row.get("Storage Type", "").strip(),
            ])

    if new_rows:
        ws.append_rows(new_rows, value_input_option="USER_ENTERED")
        print(f"Added {len(new_rows)} client(s). Skipped {skipped} duplicate(s).")
    else:
        print(f"No new clients to add (all {skipped} were already present).")


def import_interactive() -> None:
    ws       = get_worksheet()
    existing = existing_property_ids(ws)
    new_rows = []

    print("\nAdd clients interactively. Press Enter with no Property ID to finish.\n")

    while True:
        pid = input("GA4 Property ID (numbers only, e.g. 123456789): ").strip()
        if not pid:
            break
        if pid in existing:
            print(f"  Property ID {pid} already in sheet — skipping.\n")
            continue

        name    = input("Client Name: ").strip()
        manager = input("Account Manager (e.g. Praful): ").strip()

        print(f"Tier options: {', '.join(TIERS)}")
        tier = input("Tier: ").strip()

        print(f"Storage Type options: {', '.join(STORAGE_TYPES)}")
        storage = input("Storage Type: ").strip()

        new_rows.append([pid, name, manager, tier, storage])
        print(f"  Added: {name} (property {pid})\n")

    if new_rows:
        ws.append_rows(new_rows, value_input_option="USER_ENTERED")
        print(f"\nSaved {len(new_rows)} client(s) to sheet.")
    else:
        print("\nNo clients added.")


def main():
    parser = argparse.ArgumentParser(description="Import clients into Client_Mapping sheet")
    group  = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--csv",         metavar="FILE", help="Import from a CSV file")
    group.add_argument("--interactive", action="store_true", help="Add clients one by one")
    args = parser.parse_args()

    if args.csv:
        import_from_csv(args.csv)
    else:
        import_interactive()


if __name__ == "__main__":
    main()
