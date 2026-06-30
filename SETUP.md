# GA4 Monitor — Complete Setup Guide

An automated monitoring system built on Google Apps Script that:
- Pulls daily GA4 metrics for all sites under your Google account (~500 properties)
- Compares 7-day and 30-day periods and fires alerts when traffic drops
- Integrates with UptimeRobot for site-down and SSL expiry detection
- Sends Critical alerts via email and Slack; weekly PDF-ready summaries every Monday

**No service account required** — the script runs as your logged-in Google account,
reusing the GA4 access you already have.

---

## Prerequisites

- Praful's Google account (already has access to all GA4 properties)
- A Slack workspace with permission to add incoming webhooks (free)
- A UptimeRobot free account with your sites already added (optional but recommended)
- About 30 minutes of browser work — then the system runs itself

---

## Step 1 — Create the Google Sheet

1. Open [sheets.google.com](https://sheets.google.com) signed in as Praful.
2. Click **Blank spreadsheet**.
3. Rename it **Client Analytics Hub** (click the title at top-left).
4. Click **+** at the bottom seven times and rename the seven new tabs **exactly**:
   - `GA4_Data`
   - `Mapping`
   - `Monday`
   - `Site Registry Master`
   - `Alert Configuration`
   - `Alerts Log`
   - `Performance Metrics`
   - `Error Log`

   > Tip: Google Sheets lets you double-click a tab to rename it.

---

## Step 2 — Open the Apps Script editor

1. With the spreadsheet open, click **Extensions → Apps Script**.
2. A new tab opens showing the editor.

---

## Step 3 — Add all script files

You need to add **eight module files** plus update the manifest. Do this once:

### 3a — Update the manifest (appsscript.json)

1. In the editor, click the gear icon (**Project Settings**) on the left sidebar.
2. Check **"Show appsscript.json manifest file in editor"**.
3. Go back to the **Editor** view (the `</>` icon).
4. Click `appsscript.json` in the file list.
5. Replace the entire contents with the contents of `apps-script/appsscript.json`
   from this repository.
6. Save (`Ctrl+S` / `Cmd+S`).

### 3b — Add module files

For each file below, in the Apps Script editor:
1. Click **+** next to "Files" in the left sidebar → "Script".
2. Name it exactly as shown (without `.gs`).
3. Select all placeholder code in the new file (`Ctrl+A`) and delete it.
4. Paste the full contents from the corresponding file in `apps-script/`.

Files to add (in order):
- `00_Config`   → paste from `apps-script/00_Config.gs`
- `01_SheetUtils` → paste from `apps-script/01_SheetUtils.gs`
- `02_GA4Fetcher` → paste from `apps-script/02_GA4Fetcher.gs`
- `03_AlertEngine` → paste from `apps-script/03_AlertEngine.gs`
- `04_UptimeMonitor` → paste from `apps-script/04_UptimeMonitor.gs`
- `05_NotificationDispatcher` → paste from `apps-script/05_NotificationDispatcher.gs`
- `06_ErrorHandler` → paste from `apps-script/06_ErrorHandler.gs`
- `07_Main`     → paste from `apps-script/07_Main.gs`

5. Replace the default `Code.gs` content with the contents of `apps-script/Code.gs`
   (it's just a comment — the real code is in the numbered files).

6. Save the project. Name it **GA4 Monitor** (click "Untitled project" at the top).

> **Alternative — use clasp:** If you have Node.js installed locally, you can push
> all files in one command:
> ```bash
> npm install -g @google/clasp
> clasp login
> # Create the Apps Script project first in the editor, then:
> clasp clone <SCRIPT_ID>
> # Copy all apps-script/*.gs files into the cloned directory, then:
> clasp push
> ```

---

## Step 4 — Enable Advanced Services

1. In the Apps Script editor, click **+** next to **Services** (left sidebar).
2. Search **Google Analytics Data API** → select it → identifier: `AnalyticsData` → **Add**.
3. Click **+** again → search **Google Analytics Admin API** → identifier: `AnalyticsAdmin` → **Add**.

Both now appear in the Services list.

---

## Step 5 — Authorise the script (one-time OAuth)

1. In the function dropdown (top of editor), select `initAllSheets`.
2. Click **Run ▶**.
3. **"Authorization required"** dialog → click **Review permissions**.
4. Choose Praful's Google account.
5. **"Google hasn't verified this app"** warning appears — this is expected for
   personal scripts. Click **Advanced → Go to GA4 Monitor (unsafe)**.
6. Review the six permission scopes and click **Allow**.

The script runs. A dialog will confirm all sheets have been initialised.

---

## Step 6 — List all GA4 properties

1. Switch back to the **Google Sheet** tab (refresh if the GA4 Monitor menu is
   not yet visible).
2. Click **GA4 Monitor → 1 — List all GA4 properties → Mapping tab**.
3. A dialog will confirm how many properties were found.

The **Mapping** tab now has every GA4 property ID and display name in columns A–B.
Columns C–F remain blank for the XLOOKUP formulas (Step 8).

---

## Step 7 — Populate the Site Registry Master

The alert engine reads from **Site Registry Master**, not from Mapping. You need
one row per site with at minimum a `Site_URL` and `GA4_Property_ID`.

**Option A — Import from Mapping (fastest):**
In a blank cell elsewhere, use this array formula to auto-fill from Mapping:
```
=ARRAYFORMULA(IF(Mapping!A2:A<>"", Mapping!A2:A, ""))
```
Then fill columns B (PropertyID from Mapping column A), C (Site_Name from Mapping B),
and set Owner/Category/Priority/Status/Date_Added manually.

**Option B — Paste from Monday.com:**
1. Export your Monday.com board to CSV/spreadsheet with columns:
   `Client | Owner | Tier | Vertical`
2. Paste into the **Monday** tab (header in row 1).
3. Use XLOOKUP to match Mapping data into Site Registry Master.

**Required columns in Site Registry Master:**
| Column | Example |
|--------|---------|
| Site_URL | https://flynnave.com |
| GA4_Property_ID | 123456789 |
| Site_Name | Flynn Avenue Self Storage |
| Owner | Gaurav |
| Category | Self Storage |
| Priority | Tier 2 |
| Status | Active |
| Date_Added | 2026-06-30 |
| Notes | (optional) |

Set `Status = Inactive` for any site you want to exclude from monitoring.

---

## Step 8 — Add XLOOKUP formulas in Mapping tab

After pasting Monday export into the Monday tab
(`Client | Owner | Tier | Vertical` in columns A–D):

1. Click **Mapping** tab → cell **D2** → paste:
   ```
   =IFERROR(XLOOKUP($B2,Monday!$A:$A,Monday!$B:$B),"")
   ```
2. Cell **E2** → paste:
   ```
   =IFERROR(XLOOKUP($B2,Monday!$A:$A,Monday!$C:$C),"")
   ```
3. Cell **F2** → paste:
   ```
   =IFERROR(XLOOKUP($B2,Monday!$A:$A,Monday!$D:$D),"")
   ```
4. Select **D2:F2** and drag the fill handle to the last row of Mapping.

Blank cells = name didn't match exactly — fill those in manually.

---

## Step 9 — Set sensitive configuration values

These are stored encrypted in ScriptProperties, never in the script code.

**Slack webhook:**
1. In Slack: open your workspace → **Apps → Incoming Webhooks → Add to Slack**.
2. Choose the channel for alerts → copy the webhook URL.
3. In the Sheet: **GA4 Monitor → 2a — Set Slack webhook URL** → paste URL → OK.

**Alert email:**
1. **GA4 Monitor → 2b — Set alert email address** → enter email → OK.

**UptimeRobot API key (optional but strongly recommended):**
1. Log in to [uptimerobot.com](https://uptimerobot.com) → **My Settings → API Settings**.
2. Copy your **Main API Key**.
3. **GA4 Monitor → 2c — Set UptimeRobot API key** → paste key → OK.

---

## Step 10 — Create triggers

1. **GA4 Monitor → 3 — Create all triggers**.
2. A confirmation dialog lists the three triggers created:
   - `pullChunk` — every 15 min (raw GA4 data into GA4_Data tab)
   - `dailyCheck` — daily at 8 AM (7-day alert comparison + uptime check)
   - `weeklyCheck` — Mondays at 9 AM (30-day comparison + weekly email)

---

## Step 11 — Kick off the first run

1. **GA4 Monitor → Pull raw GA4 data NOW** — starts filling GA4_Data immediately.
2. **GA4 Monitor → Run daily alert check NOW** — runs the first 7-day comparison.
   The Alerts Log tab will start showing results for any sites with significant drops.

The first full pass of all properties takes 4–8 hours across multiple 15-min chunks.
Watch **Extensions → Apps Script → Executions** for live progress.

---

## Step 12 — Build the Looker Studio dashboard

See **LOOKER_STUDIO.md** for the 4-view dashboard build guide.

---

## Alert threshold customisation

Edit values directly in the **Alert Configuration** tab:

| Column | Description |
|--------|-------------|
| Metric_Name | `sessions`, `totalUsers`, `newUsers`, `engagementRate`, `conversions` |
| Comparison_Window | `7d` or `30d` |
| Threshold_Percent | e.g., `-20` means alert if metric drops ≥20% |
| Severity | `Critical`, `Warning`, or `Info` |
| Notification_Method | `Email+Slack`, `Slack`, or `Email` |
| Active | `TRUE` or `FALSE` |

Changes take effect on the next `dailyCheck` or `weeklyCheck` run.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| GA4 Monitor menu missing | Refresh the spreadsheet tab; if still missing, open Apps Script and run `onOpen()` manually |
| "Advanced service AnalyticsData not enabled" | Return to Step 4 |
| "Exception: Script timeout" | Normal — script stops before the 6-min limit and resumes next trigger run |
| Alerts Log empty after dailyCheck | Check Error Log tab for API errors; run "Pull raw GA4 data NOW" to verify connectivity |
| Slack not receiving messages | Verify webhook URL in GA4 Monitor menu; test manually with `curl` |
| "No Item with given ID" error for a property | That property was deleted or access was removed — script skips it and logs the error |
| Alert Configuration shows no matching rules | Ensure the `Active` column is `TRUE` (not text "true") |
