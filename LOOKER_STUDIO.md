# Looker Studio Dashboard — Build Guide

This guide builds the "Client Analytics Hub" manager dashboard in Looker Studio.
Prerequisites: the Google Sheet must have data in both `GA4_Data` and `Mapping`
tabs (complete SETUP.md Steps 1–10 first).

Total time: ~30 minutes.

---

## Part 1 — Connect data sources

### 1.1 Create a new report

1. Open [lookerstudio.google.com](https://lookerstudio.google.com) signed in as
   Praful.
2. Click **Create → Report**.
3. An **"Add data to report"** panel opens on the right.

### 1.2 Add the GA4_Data source

1. In the panel, click the **Google Sheets** connector.
2. Select the **Client Analytics Hub** spreadsheet.
3. Select the **GA4_Data** tab.
4. Make sure **"Use first row as headers"** is checked.
5. Click **Add** (bottom-right).
6. A dialog asks "Add to report?" — click **Add to report**.

### 1.3 Add the Mapping source

1. In the Looker Studio toolbar, click **Resource → Manage added data sources**.
2. Click **Add a data source** (bottom-left of the panel).
3. Click **Google Sheets** again.
4. Select **Client Analytics Hub → Mapping tab**.
5. Make sure **"Use first row as headers"** is checked.
6. Click **Add**, then **Add to report**.
7. Close the "Manage data sources" panel.

---

## Part 2 — Create the blend

The blend joins GA4_Data + Mapping on PropertyID so every row carries Owner,
Tier, Vertical, and PropertyName alongside the metrics.

1. Click **Resource → Manage blends**.
2. Click **Add a blend**.
3. The blend builder opens with two "table" slots.

**Left table (GA4_Data):**
1. Click the **GA4_Data** source in the left table.
2. Included fields: check `PropertyID`, `Date`, `Users`, `Sessions`, `Conversions`.

**Right table (Mapping):**
1. Click **"Join another table"** next to the right table slot.
2. Select the **Mapping** source.
3. Included fields: check `PropertyID`, `PropertyName`, `Owner`, `Tier`, `Vertical`.

**Join condition:**
1. Under "Join conditions", set the left key to **GA4_Data.PropertyID** and
   the right key to **Mapping.PropertyID**.
2. Leave join type as **Left outer** (keeps all GA4_Data rows even if a property
   has no mapping row yet).

**Name and save:**
1. In the blend name field (top), type **GA4 + Client Info**.
2. Click **Save**.
3. Close the blend panel.

---

## Part 3 — Set field types in the blend

1. Click **Resource → Manage added data sources**.
2. Click **Edit** next to **GA4 + Client Info**.
3. Set these field types and aggregations:

   | Field         | Type    | Aggregation |
   |---------------|---------|-------------|
   | Date          | Date    | —           |
   | PropertyID    | Text    | —           |
   | PropertyName  | Text    | —           |
   | Owner         | Text    | —           |
   | Tier          | Text    | —           |
   | Vertical      | Text    | —           |
   | Users         | Number  | Sum         |
   | Sessions      | Number  | Sum         |
   | Conversions   | Number  | Sum         |

4. Click **Done**, then close the panel.

---

## Part 4 — Dashboard layout

The canvas is now blank. Build from top to bottom.

### 4.1 Add a title

1. Click **Insert → Text**.
2. Draw a wide text box at the top.
3. Type **Client Analytics Hub**.
4. Use the Style panel (right side) to set a large bold font.

### 4.2 Date range control

1. Click **Insert → Date range control**.
2. Draw it in the top-right area.
3. In the **Setup** panel (right side):
   - Data source: **GA4 + Client Info**
   - Default date range: **Last 30 days** (or your preference)

### 4.3 Filter controls — Owner, Tier, Vertical

Repeat three times (one for each dimension):

1. Click **Insert → Filter control**.
2. Draw a narrow dropdown below the date range.
3. In the **Setup** panel:
   - Data source: **GA4 + Client Info**
   - Control field: **Owner** (then repeat for **Tier** and **Vertical**)
4. In the **Style** panel, check **"Show search"** — helpful with ~300 owners.
5. Label each control (double-click to edit the header text).

### 4.4 Scorecard headline metrics

1. Click **Insert → Scorecard**.
2. Draw a wide-but-short box.
3. In **Setup**:
   - Data source: **GA4 + Client Info**
   - Metric: **Users**
4. In **Style**, set a large compact number.
5. Copy–paste the scorecard twice; change the metric to **Sessions** and
   **Conversions** respectively.
6. Arrange the three scorecards side-by-side.

> **Note on "Users":** This metric sums daily user counts across the selected
> date range, so a visitor who returns on three different days is counted three
> times. It measures traffic volume, not unique persons. Sessions and Conversions
> sum cleanly. Consider labelling the scorecard "Total User-Days" to avoid
> confusion.

### 4.5 Roll-up tables

Add three tables, one per roll-up dimension. For each:

1. Click **Insert → Table**.
2. Draw a tall-ish box.
3. In **Setup**:
   - Data source: **GA4 + Client Info**
   - Dimension: see below
   - Metrics: **Users**, **Sessions**, **Conversions** (click **+ Add metric** twice)
   - Default sort: **Sessions** Descending
4. In **Style**, check **"Row numbers"** and **"Show pagination"** if needed.

Table configurations:

| Table | Dimension | Purpose |
|-------|-----------|---------|
| 1     | Tier      | Roll-up by tier (Legacy / Tier 1 / 2 / 3) |
| 2     | Vertical  | Roll-up by vertical (Storable / EasyStorage) |
| 3     | Owner     | Roll-up by person (Gaurav / Abhijeet / Praful / Me) |

Arrange these three tables side-by-side below the scorecards.

### 4.6 (Optional) Sessions trend — time series

1. Click **Insert → Time series**.
2. Draw a wide chart below the roll-up tables.
3. In **Setup**:
   - Data source: **GA4 + Client Info**
   - Dimension: **Date**
   - Metric: **Sessions**
4. The date range control at the top will drive this chart automatically.

### 4.7 (Optional) Per-site detail table

1. Click **Insert → Table**.
2. In **Setup**:
   - Data source: **GA4 + Client Info**
   - Dimension: **PropertyName**
   - Metrics: **Users**, **Sessions**, **Conversions**
   - Default sort: **Sessions** Descending
3. In **Style**, enable **"Show pagination"** (900 rows benefits from pages of 25).

---

## Part 5 — Make the controls affect all charts

By default Looker Studio date-range controls and filter controls only affect
charts on the same page. Verify each chart responds:

1. Click a chart.
2. In the **Setup** panel, scroll down to **"Filter interaction"** and make sure
   **"Cross-filter"** or the filter control is not excluded.
3. For the date range: each chart's date dimension must be the `Date` field from
   the blend (not a text field).

If a chart ignores the date control, click the chart → Setup → Date Range
Dimension → set it to **Date**.

---

## Part 6 — Share the dashboard

1. Click **Share** (top-right of Looker Studio).
2. Under **"Manage access"**, set to **"Anyone with the link — Viewer"** or
   share with specific email addresses.
3. Copy the link and send it to Gaurav, Abhijeet, and the VP.

Viewers can use all the filters and date controls without editing the report.

---

## Refresh cadence

The underlying Google Sheet is refreshed once per day (the Apps Script finishes
a full pass of all ~900 properties across multiple 15-min chunks). Looker Studio
caches data for up to 12 hours by default.

To force an immediate data refresh in Looker Studio:
- Click **Resource → Manage added data sources → Edit** on the GA4_Data source
  → click the **Refresh fields** button → Done.

Or simply wait — daily data is sufficient for this use case.

---

## Quick-reference: field cheat-sheet

| Blend field   | Comes from  | Use as    | Aggregation |
|---------------|-------------|-----------|-------------|
| Date          | GA4_Data    | Dimension | —           |
| PropertyID    | GA4_Data    | Dimension | —           |
| PropertyName  | Mapping     | Dimension | —           |
| Owner         | Mapping     | Dimension | —           |
| Tier          | Mapping     | Dimension | —           |
| Vertical      | Mapping     | Dimension | —           |
| Users         | GA4_Data    | Metric    | SUM         |
| Sessions      | GA4_Data    | Metric    | SUM         |
| Conversions   | GA4_Data    | Metric    | SUM         |

**Conversions** = what GA4 calls "Key Events" in its UI. The Data API metric
name is still `conversions` — that is correct and what the script uses.
