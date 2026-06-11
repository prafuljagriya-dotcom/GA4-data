# Client Analytics Hub — Setup Guide

One Google Sheet + one Apps Script pulls daily GA4 metrics (Users, Sessions,
Conversions) for all ~900 client properties into a single sheet. Looker Studio
reads that sheet and renders the manager dashboard. No service account needed —
the script runs as Praful's login and reuses the GA4 access he already has.

---

## What you need before starting

- Praful's Google account (already has viewer access to all ~900 GA4 properties)
- A Monday.com board export as a spreadsheet with columns:
  `Client | Owner | Tier | Vertical`
- About 15 minutes of browser work, then the system runs itself

---

## Step 1 — Create the Google Sheet

1. Open [Google Sheets](https://sheets.google.com) signed in as Praful.
2. Click **Blank spreadsheet**.
3. Rename it **Client Analytics Hub** (click the title at top-left).
4. Create three tabs by clicking the **+** at the bottom-left three times and
   rename them exactly (case-sensitive):
   - `GA4_Data`
   - `Mapping`
   - `Monday`
5. Copy the URL of the spreadsheet — you will need the ID later
   (the long string between `/d/` and `/edit` in the URL).

---

## Step 2 — Open the Apps Script editor

1. With the spreadsheet open, click **Extensions → Apps Script**.
   A new browser tab opens showing the script editor.
2. On the left sidebar, you will see a default file called `Code.gs`.
   Click on it.
3. **Select all** the placeholder code in the editor (`Ctrl+A` / `Cmd+A`)
   and **delete** it.

---

## Step 3 — Paste the script

1. Open `apps-script/Code.gs` from this repository.
2. Copy the entire contents.
3. Paste it into the Apps Script editor (the blank area).
4. Click **Save** (the floppy-disk icon, or `Ctrl+S` / `Cmd+S`).
   The project name will show as "Untitled project" — rename it to
   **GA4 Dashboard** by clicking that text at the top.

---

## Step 4 — Enable the two Advanced Services

The script uses two APIs that must be explicitly enabled:

1. In the Apps Script editor, click the **+** next to **Services** in the
   left sidebar.
2. Search for **Google Analytics Data API** — select it, leave the identifier
   as `AnalyticsData`, click **Add**.
3. Click **+** again, search for **Google Analytics Admin API** — select it,
   leave the identifier as `AnalyticsAdmin`, click **Add**.

Both services now appear in the Services list.

> **If you see a Cloud project warning:** Apps Script may ask you to switch to
> a standard Cloud project. Click "Change project", create a new project in
> Google Cloud Console, and link it. Then enable both APIs in that Cloud project
> via **APIs & Services → Library**.

---

## Step 5 — Authorise the script (one-time OAuth)

1. In the editor, select the function `listAllProperties` from the dropdown
   next to the Run button (▶).
2. Click **Run (▶)**.
3. A dialog appears: **"Authorization required"** → click **Review permissions**.
4. Choose Praful's Google account.
5. You will see **"Google hasn't verified this app"** — this is expected because
   it is a personal script. Click **Advanced → Go to GA4 Dashboard (unsafe)**.
6. Review the permissions (read Google Analytics data, edit this spreadsheet,
   manage triggers) → click **Allow**.

The script runs. A dialog will appear saying how many GA4 properties were found.

---

## Step 6 — Check the Mapping tab

Open the spreadsheet (switch back to the Sheets tab). The **Mapping** tab should
now have rows like:

| PropertyID | PropertyName           | Client | Owner | Tier | Vertical |
|------------|------------------------|--------|-------|------|----------|
| 123456789  | Flynn Avenue Self Stor |        |       |      |          |
| 987654321  | Acme Storage           |        |       |      |          |

Columns A–B are filled. Columns C–F are blank and will be populated in Step 8.

---

## Step 7 — Paste the Monday.com export

1. Export your Monday.com board to a spreadsheet (CSV or direct copy-paste).
   Required columns in this exact order:
   ```
   Client | Owner | Tier | Vertical
   ```
   Example rows:
   ```
   Flynn Avenue Self Storage | Gaurav  | Tier 2  | Storable
   Acme Storage              | Abhijeet| Legacy  | EasyStorage
   ```
2. Click the **Monday** tab in the Google Sheet.
3. Paste your data starting at **cell A1**, with the header row as the first row.

---

## Step 8 — Add XLOOKUP formulas in the Mapping tab

These formulas look up each property name in the Monday tab and fill in
Owner, Tier, and Vertical automatically.

1. Click the **Mapping** tab.
2. Click cell **D2** and paste:
   ```
   =IFERROR(XLOOKUP($B2,Monday!$A:$A,Monday!$B:$B),"")
   ```
3. Click cell **E2** and paste:
   ```
   =IFERROR(XLOOKUP($B2,Monday!$A:$A,Monday!$C:$C),"")
   ```
4. Click cell **F2** and paste:
   ```
   =IFERROR(XLOOKUP($B2,Monday!$A:$A,Monday!$D:$D),"")
   ```
5. Select **D2:F2**, then drag the fill handle (small square at the bottom-right
   of the selection) **all the way down** to the last row in the Mapping tab.

Rows where the GA4 property name does not exactly match a Monday client name
will show blank Owner/Tier/Vertical. Scan the sheet for blanks and fill them in
manually — they typically differ only in punctuation or abbreviation.

---

## Step 9 — Set up the automatic trigger

1. Go back to the Apps Script editor tab.
2. In the spreadsheet, a new menu **GA4 Dashboard** has appeared in the menu bar.
   (If not, refresh the spreadsheet tab.)
3. Click **GA4 Dashboard → Step 2 — Create 15-min auto-trigger**.
4. Click **Allow** in the authorization dialog if it appears.
5. A confirmation dialog appears — click **OK**.

The trigger is now active. Every 15 minutes, `pullChunk()` will process a batch
of properties and write rows into the GA4_Data tab. Because there are ~900
properties and each API call takes ~0.3 s, a full pass takes approximately
4–6 hours the first time.

---

## Step 10 — Kick off the first pull right now

You do not need to wait for the next scheduled run:

1. Click **GA4 Dashboard → Pull data now (single chunk)**.
2. Switch to the **GA4_Data** tab — rows will start appearing within ~30 seconds.

To watch progress, check **Execution log** in the Apps Script editor
(View → Executions).

---

## Step 11 — Build the Looker Studio dashboard

See **LOOKER_STUDIO.md** for step-by-step instructions.

---

## Maintenance

| Task | How |
|------|-----|
| Force a fresh pull of all properties | **GA4 Dashboard → Force full refresh** |
| A new client was added | Re-run **Step 1 — List all GA4 properties**, then re-apply XLOOKUP formulas |
| Monday data changed (new owner, tier) | Paste updated Monday export into the Monday tab — XLOOKUPs auto-refresh |
| Data looks stale | Check **Apps Script → Executions** for errors; run **Pull data now** manually |
| Change lookback window | Edit `LOOKBACK_DAYS` at top of `Code.gs` (default: 90) |

---

## Troubleshooting

**"Exception: No Item with the given ID was found"**
The property was deleted or Praful's account lost access. The script logs it and
skips it — this is expected for a small number of properties.

**"You do not have permission to call AnalyticsAdmin"**
The Advanced Services were not enabled correctly. Return to Step 4.

**"Exception: Script timeout"**
Normal — the script intentionally stops before the 6-minute Apps Script limit
and resumes at the next trigger run. Not an error.

**Mapping tab shows all-blank Owner/Tier/Vertical**
The Monday tab is empty or column order is wrong. Check that Monday!A = Client,
B = Owner, C = Tier, D = Vertical with a header in row 1.

**The GA4 Dashboard menu does not appear**
Refresh the spreadsheet tab. If it still does not appear, the `onOpen` trigger
may need re-authorization — open Extensions → Apps Script and run `onOpen`
manually once.
