# GA4 Auto-Pull — Setup Guide

This tool pulls GA4 analytics data (Sessions, Active Users, Conversions) for all
your storage facility clients and writes it into your Google Sheet automatically.

---

## Step 1 — Create a Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable these two APIs:
   - **Google Analytics Data API** (search "Analytics Data API")
   - **Google Sheets API**
4. Go to **IAM & Admin → Service Accounts → Create Service Account**
   - Name it something like `storable-seo-bot`
   - No extra roles needed at this stage
5. Click the service account → **Keys tab → Add Key → JSON**
6. Download the JSON file and save it as `service_account.json` in this folder

---

## Step 2 — Share GA4 properties with the service account

For **each client's GA4 property**, you need to add the service account as a viewer:

1. Open **Google Analytics → Admin → Property → Property Access Management**
2. Click **+** and add the service account email (looks like `storable-seo-bot@your-project.iam.gserviceaccount.com`)
3. Give it **Viewer** role
4. Repeat for every client property

> **Tip:** You only need to do this once per property. After that, the script
> can pull data forever without any manual steps.

---

## Step 3 — Install Python dependencies

```bash
pip install -r requirements.txt
```

---

## Step 4 — Configure environment

```bash
cp .env.example .env
```

Open `.env` and set:
- `GOOGLE_SERVICE_ACCOUNT_FILE` — path to your JSON key (usually `service_account.json`)
- `SPREADSHEET_ID` — already set to your Daily_Performance sheet ID

---

## Step 5 — Add your clients

Option A: From a CSV file (fastest for 40+ clients)
```bash
python import_clients.py --csv my_clients.csv
```

Your CSV should have these columns:
```
Property ID,Client Name,Account Manager,Tier,Storage Type
123456789,Flynn Avenue Self Storage,Praful,Tier 3,Self Storage
```

Option B: Add one by one
```bash
python import_clients.py --interactive
```

---

## Step 6 — Run the pull

Pull yesterday's data for all clients:
```bash
python ga4_pull.py
```

Pull a specific date:
```bash
python ga4_pull.py --start-date 2026-06-01
```

Pull a date range (e.g. backfill last 30 days):
```bash
python ga4_pull.py --start-date 2026-05-01 --end-date 2026-05-31
```

Test without writing to sheet:
```bash
python ga4_pull.py --dry-run
```

Pull just one client:
```bash
python ga4_pull.py --client "Flynn Avenue"
```

---

## Step 7 — Schedule to run daily (optional)

**On Mac/Linux (cron):**
```bash
crontab -e
```
Add this line to run every morning at 6 AM:
```
0 6 * * * cd /path/to/GA4-data && python ga4_pull.py >> logs/ga4_pull.log 2>&1
```

**On Windows (Task Scheduler):**
- Action: `python C:\path\to\GA4-data\ga4_pull.py`
- Trigger: Daily at 6:00 AM

---

## Finding a GA4 Property ID

1. Open **Google Analytics**
2. Go to **Admin → Property Settings**
3. Copy the **Property ID** (a 9–10 digit number like `123456789`)

> This is NOT the same as the Measurement ID (which starts with `G-`).
