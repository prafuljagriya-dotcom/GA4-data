# Looker Studio Dashboard — Build Guide

This guide builds the 4-view manager dashboard. Prerequisites: the Google Sheet
must have data in **GA4_Data**, **Mapping**, **Site Registry Master**, and
**Alerts Log** tabs (complete SETUP.md first).

Total build time: ~45 minutes.

---

## Dashboard overview

| Page | Audience | Purpose |
|------|----------|---------|
| 1 — Executive Summary | VP / Manager | Portfolio-wide KPIs, owner roll-ups, date filter |
| 2 — Individual Performance | Team leads | Per-site traffic and conversions table |
| 3 — Alert Center | Everyone | Open alerts with severity filter |
| 4 — Technical Health | DevOps | Uptime and SSL status from Alerts Log |

---

## Part 1 — Connect data sources

### 1.1 Create a new report

1. Open [lookerstudio.google.com](https://lookerstudio.google.com) signed in as Praful.
2. Click **Create → Report**.
3. The "Add data to report" panel opens.

### 1.2 GA4_Data source

1. Click **Google Sheets**.
2. Select **Client Analytics Hub** → **GA4_Data** tab.
3. Check **"Use first row as headers"**.
4. Click **Add → Add to report**.

### 1.3 Site Registry Master source

1. Click **Resource → Manage added data sources → Add a data source → Google Sheets**.
2. Select **Client Analytics Hub → Site Registry Master**.
3. Check **"Use first row as headers"** → **Add → Done**.

### 1.4 Alerts Log source

1. Add another data source → **Google Sheets → Client Analytics Hub → Alerts Log**.
2. Check headers → **Add → Done**.

### 1.5 Close the data sources panel.

---

## Part 2 — Create the GA4 + Registry blend

The blend joins GA4_Data (metrics) with Site Registry Master (Owner, Category,
Priority) on PropertyID.

1. Click **Resource → Manage blends → Add a blend**.
2. **Left table**: GA4_Data.
   - Include fields: `PropertyID`, `Date`, `Users`, `Sessions`, `Conversions`.
3. **Join another table** → right table: Site Registry Master.
   - Include fields: `GA4_Property_ID`, `Site_Name`, `Owner`, `Category`, `Priority`, `Site_URL`.
4. **Join condition**: `GA4_Data.PropertyID = Site Registry Master.GA4_Property_ID`.
5. **Join type**: Left outer (keeps all GA4 rows).
6. Name the blend **GA4 + Registry**.
7. Click **Save**.

### Set field types in the blend

1. **Resource → Manage added data sources → Edit** (GA4 + Registry).
2. Set aggregations:

   | Field         | Type    | Aggregation |
   |---------------|---------|-------------|
   | Date          | Date    | —           |
   | PropertyID    | Text    | —           |
   | Site_Name     | Text    | —           |
   | Site_URL      | Text    | —           |
   | Owner         | Text    | —           |
   | Category      | Text    | —           |
   | Priority      | Text    | —           |
   | Users         | Number  | Sum         |
   | Sessions      | Number  | Sum         |
   | Conversions   | Number  | Sum         |

3. Click **Done**.

---

## Part 3 — Page 1: Executive Summary

In Looker Studio, click **Add page** (bottom left) and name it **Executive Summary**.

### Header row

**Title text box:**
1. Insert → Text → draw a wide box at the top.
2. Type **Client Analytics Hub**.
3. Style: large bold font, centered.

**Date range control:**
1. Insert → Date range control.
2. Draw top-right. Data source: **GA4 + Registry**. Default: **Last 30 days**.

**Owner filter:**
1. Insert → Filter control. Draw beside date range.
2. Data source: GA4 + Registry. Control field: **Owner**. Show search: on.

**Tier / Priority filter:**
1. Repeat for **Priority**.

**Vertical / Category filter:**
1. Repeat for **Category**.

### Scorecard row (KPIs)

Add three scorecards side-by-side:

| Scorecard | Metric | Label |
|-----------|--------|-------|
| 1 | Sessions (SUM) | Total Sessions |
| 2 | Users (SUM) | Total User-Days* |
| 3 | Conversions (SUM) | Total Conversions |

*Add a text note below scorecards: "User-Days = sum of daily user counts; repeat
visitors across days are counted multiple times. Sessions and Conversions sum cleanly."

Steps for each scorecard:
1. Insert → Scorecard.
2. Setup panel: Data source = GA4 + Registry. Metric = [see table above].
3. Style panel: compact number format, large font.

### Roll-up tables

Add three tables below the scorecards:

**Table 1 — By Owner:**
1. Insert → Table.
2. Dimension: Owner. Metrics: Sessions, Users, Conversions.
3. Sort by Sessions descending. Enable row numbers.

**Table 2 — By Priority (Tier):**
1. Same setup. Dimension: Priority.

**Table 3 — By Category (Vertical):**
1. Same setup. Dimension: Category.

Arrange the three tables side-by-side.

### Sessions trend chart (optional)

1. Insert → Time series.
2. Dimension: Date. Metric: Sessions.
3. Resize to span the full width below the tables.

---

## Part 4 — Page 2: Individual Performance

Add a new page and name it **Individual Performance**.

1. Copy the header controls (date range + filters) from Page 1:
   Right-click each → Copy → switch to Page 2 → Paste.

### Site detail table

1. Insert → Table.
2. Data source: GA4 + Registry.
3. Dimensions: Site_Name, Owner, Priority, Category.
4. Metrics: Sessions, Users, Conversions.
5. Sort: Sessions Descending.
6. Style: enable **Pagination** (25 rows per page).

### Bar chart — Top 20 sites by Sessions

1. Insert → Bar chart.
2. Data source: GA4 + Registry.
3. Dimension: Site_Name.
4. Metric: Sessions.
5. Sort: Sessions Descending. Limit rows to 20.

---

## Part 5 — Page 3: Alert Center

Add a new page and name it **Alert Center**.

### Alert summary scorecards

Add four scorecards using the **Alerts Log** data source:

| Scorecard | Metric | Filter |
|-----------|--------|--------|
| Open Critical | Record Count | Severity = Critical AND Status = Open |
| Open Warnings | Record Count | Severity = Warning AND Status = Open |
| Total This Week | Record Count | Date range: last 7 days |
| Resolved | Record Count | Status = Resolved |

To apply a filter per scorecard:
1. Click the scorecard → Setup panel → scroll to **Filter** → **Add a filter**.
2. Create a new filter with the condition above.

### Alert type filter

1. Insert → Filter control. Control field: **Alert_Type** (Alerts Log source).

### Severity filter

1. Insert → Filter control. Control field: **Severity**.

### Alerts detail table

1. Insert → Table. Data source: **Alerts Log**.
2. Dimensions: Timestamp, Site_URL, Alert_Type, Severity, Issue_Description,
   Assigned_To, Status.
3. Sort: Timestamp Descending.
4. Pagination: on (25 rows per page).
5. Conditional formatting on Severity:
   - Severity = Critical → background red
   - Severity = Warning  → background yellow

To add conditional formatting:
1. Select the Severity column in the table.
2. Style panel → Conditional formatting → Add rule.

---

## Part 6 — Page 4: Technical Health

Add a new page and name it **Technical Health**.

### Site-down summary (from Alerts Log)

1. Insert → Table. Data source: Alerts Log.
2. Filter the chart: Alert_Type IN (SITE_DOWN, SITE_DEGRADED, SSL_EXPIRY, SLOW_RESPONSE).
3. Dimensions: Timestamp, Site_URL, Alert_Type, Severity, Issue_Description.
4. Sort: Timestamp Descending.

### SSL expiry countdown chart

1. Insert → Table. Data source: Alerts Log.
2. Filter: Alert_Type = SSL_EXPIRY.
3. Dimensions: Site_URL, Metric_Value (days remaining), Timestamp.
4. Sort: Metric_Value Ascending (soonest expiry first).

### Uptime alert trend (optional)

1. Insert → Time series. Data source: Alerts Log.
2. Dimension: Timestamp (date).
3. Metric: Record Count.
4. Filter: Alert_Type = SITE_DOWN.

---

## Part 7 — Share the dashboard

1. Click **Share** (top-right).
2. Set access to **"Anyone with the link — Viewer"** for the manager.
3. Or share with specific email addresses for tighter control.

Viewers can use all filters and date controls without edit access.

---

## Part 8 — Scheduled PDF delivery (Monday 9 AM)

Looker Studio can email a scheduled PDF report automatically.

1. In your report, click **Share → Schedule email delivery**.
2. Recipients: manager's email address.
3. Schedule: **Weekly → Monday → 9:00 AM** (or your manager's timezone).
4. Report pages to include: select **Executive Summary** and **Alert Center**.
5. Click **Save**.

The manager receives a PDF snapshot every Monday without any manual steps.

---

## Data refresh notes

- **GA4_Data** sheet is refreshed continuously by `pullChunk()` (every 15 min).
- **Alerts Log** is updated daily at 8 AM and again on Mondays at 9 AM.
- Looker Studio caches data for up to 12 hours by default.
- To force a Looker Studio refresh: Resource → Manage data sources → Edit → Refresh fields.

---

## Quick field reference

| Blend field   | Source             | Type   | Agg |
|---------------|--------------------|--------|-----|
| Date          | GA4_Data           | Date   | —   |
| PropertyID    | GA4_Data           | Text   | —   |
| Site_Name     | Site Registry Master | Text | —   |
| Site_URL      | Site Registry Master | Text | —   |
| Owner         | Site Registry Master | Text | —   |
| Category      | Site Registry Master | Text | —   |
| Priority      | Site Registry Master | Text | —   |
| Users         | GA4_Data           | Number | SUM |
| Sessions      | GA4_Data           | Number | SUM |
| Conversions   | GA4_Data           | Number | SUM |

**Conversions** = what GA4 calls "Key Events" in its UI. The Data API metric
name is still `conversions` — that is correct and what the script uses.
