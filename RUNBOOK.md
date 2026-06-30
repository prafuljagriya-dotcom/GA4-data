# GA4 Monitor — Runbook

Day-to-day operations reference for the team.

---

## Adding new sites

**Time required:** < 5 minutes per site (or bulk-import from CSV).

### Single site

1. Open **Site Registry Master** in the Google Sheet.
2. Add a new row with all columns filled:
   - `Site_URL` — full URL including https://
   - `GA4_Property_ID` — 9-10 digit number (see below)
   - `Site_Name` — human-readable name
   - `Owner` — must exactly match an Owner value already in the sheet
   - `Category` — e.g., Self Storage, RV Storage
   - `Priority` — Legacy, Tier 1, Tier 2, or Tier 3
   - `Status` — `Active`
   - `Date_Added` — today's date
3. The next `pullChunk()` run (within 15 min) will pick up the new property.
4. The first alert comparison for this site runs at 8 AM the next day.

**Finding a GA4 Property ID:**
1. Open Google Analytics → Admin (gear icon) → select the property.
2. Scroll to **Property Settings** → copy the **Property ID** (numbers only, e.g., `123456789`).
   - This is NOT the Measurement ID (which starts with `G-`).

### Bulk import (50+ sites)

1. Prepare a spreadsheet with headers matching Site Registry Master exactly.
2. Copy all rows.
3. Paste into Site Registry Master starting at the first blank row below the header.

---

## Removing / deactivating a site

1. Find the site row in **Site Registry Master**.
2. Change the `Status` column from `Active` to `Inactive`.
3. The site will be excluded from the next pull and alert check immediately.

Do **not** delete the row — keeping the history in the sheet is useful.

---

## Modifying alert thresholds

1. Open **Alert Configuration** tab.
2. Edit the `Threshold_Percent` value for the rule you want to change.
   - Negative number = drop threshold. Example: `-25` means alert when metric drops ≥25%.
3. To disable a rule temporarily, set `Active` to `FALSE`.
4. To add a new rule, add a row with all six columns filled.

Changes take effect on the **next trigger run** (8 AM for 7-day, Monday 9 AM for 30-day).

---

## Resolving an alert

1. Open **Alerts Log** tab.
2. Find the alert row.
3. Set `Status` column to `Resolved`.
4. Add a note in `Resolution_Notes`.
5. Enter the resolution timestamp in `Resolution_Time`.

Resolved alerts stay in the log for historical reference but are excluded from
open-alert scorecards in Looker Studio (if you've applied the Status = Open filter).

---

## Changing the Slack channel or webhook

1. Create a new Slack webhook for the target channel (Slack → Apps → Incoming Webhooks).
2. In the spreadsheet: **GA4 Monitor → 2a — Set Slack webhook URL** → paste new URL.
3. Test by running **GA4 Monitor → Run daily alert check NOW** with a low threshold temporarily.

---

## Troubleshooting

### The Alerts Log is empty after 8 AM

1. Open **Extensions → Apps Script → Executions**.
2. Look for `dailyCheck` runs. If they failed, click the run to see the error.
3. Check **Error Log** tab for API errors from that time.
4. Common fixes:
   - "Advanced service not enabled" → re-enable in Services panel (Step 4 of SETUP.md).
   - "User does not have sufficient permissions" → the property was removed from the GA4 account.
   - Timeout errors → normal for first run, retries on next trigger.

### GA4_Data is not updating

1. Check **Apps Script → Executions** for `pullChunk` runs.
2. If runs are missing, the trigger may have been deleted. Run **GA4 Monitor → 3 — Create all triggers**.
3. If runs show errors, check Error Log tab.
4. Run **GA4 Monitor → Pull raw GA4 data NOW** to test manually.

### Slack is not receiving notifications

1. Verify the webhook URL is set: from Apps Script editor, run this in the console:
   ```javascript
   Logger.log(PropertiesService.getScriptProperties().getProperty('SLACK_WEBHOOK_URL'));
   ```
2. If empty, re-enter via **GA4 Monitor → 2a — Set Slack webhook URL**.
3. Test the webhook manually with `curl -X POST -H 'Content-type: application/json' --data '{"text":"test"}' YOUR_WEBHOOK_URL`.

### Email not arriving

1. Verify email: run in Apps Script console:
   ```javascript
   Logger.log(PropertiesService.getScriptProperties().getProperty('ALERT_EMAIL'));
   ```
2. Check spam folder — the sender address will be Praful's Gmail address.
3. Apps Script's `MailApp` has a daily limit of 100 emails/day (free) or 1,500/day
   (Google Workspace). If the limit is hit, emails stop until the next day.

### Too many false-positive alerts

1. Raise thresholds in **Alert Configuration** (e.g., change `-15` to `-25`).
2. Alternatively, mark frequently-alerting rules as `Active = FALSE` temporarily.
3. Consider adding a minimum absolute value check — the percentage formula fires on
   sites with very low baseline traffic (e.g., 2 sessions → 1 session = -50%).
   You can filter these out in Looker Studio by adding a minimum Sessions filter.

### A site is showing huge traffic swings every day

Usually caused by a zero or near-zero baseline in the "previous" period.
Check the GA4 property directly and verify data collection is working. If the
property has no data in the comparison window, the alert is technically correct
(100% drop) but not actionable — add a note in the Mapping tab and optionally
set `Status = Inactive` until the site's tracking is fixed.

---

## Scaling to 1,000+ sites

The system uses cursor-based chunked processing. At 500 sites, a full alert pass
takes ~4 minutes (within the 6-min Apps Script limit). At 1,000 sites, a single
run will hit the time budget halfway through. The cursor saves progress and the
next 15-min trigger continues automatically — no data is lost.

To increase throughput:
1. **Reduce lookback window:** In `00_Config.gs`, lower `LOOKBACK_DAYS` from 90 to 30.
   This reduces the number of raw data rows per property.
2. **Increase trigger frequency:** You can change `everyMinutes(15)` to `everyMinutes(10)`
   in `setupTriggers()` (Apps Script minimum is 1 minute).
3. **Google Workspace upgrade:** Workspace accounts get longer script execution limits
   (up to 30 minutes) and higher API quotas. At 1,000+ sites this is worth it.
4. **Parallel processing:** For > 2,000 sites, consider splitting the registry into
   two sheets and running two separate Apps Script projects in parallel.

---

## System architecture overview

```
Every 15 min:
  pullChunk()
    → reads Site Registry Master (property IDs)
    → calls GA4 Data API (90-day raw data per property)
    → writes to GA4_Data tab

Daily 8 AM:
  dailyCheck()
    → evaluateAlerts('7d')
       → for each site: calls GA4 Data API (7d current vs 7d previous)
       → writes matching alerts to Alerts Log
       → dispatches email (Critical) + Slack (Critical + Warning)
    → checkUptimeRobot()
       → calls UptimeRobot API
       → writes site-down / SSL / slow-response alerts to Alerts Log

Monday 9 AM:
  weeklyCheck()
    → evaluateAlerts('30d') (same as above but 30-day window)
    → sendWeeklyReport() (plain-text summary email)

Looker Studio (continuous):
  → reads GA4_Data + Site Registry Master blend
  → reads Alerts Log
  → scheduled PDF delivery to manager every Monday 9 AM
```

---

## Key file locations

| File | Purpose |
|------|---------|
| `apps-script/00_Config.gs` | All constants — change thresholds here |
| `apps-script/07_Main.gs` | Trigger schedules — change timing here |
| `SETUP.md` | Initial setup guide |
| `LOOKER_STUDIO.md` | Dashboard build instructions |
| **Site Registry Master** (sheet) | Master list of sites to monitor |
| **Alert Configuration** (sheet) | Per-metric alert thresholds |
| **Alerts Log** (sheet) | All generated alerts with status |
| **Error Log** (sheet) | API errors and failures |
