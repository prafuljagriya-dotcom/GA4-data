// =============================================================================
// GA4 FETCHER
//
// Two independent data-fetch flows:
//   1. pullChunk()            — raw daily data → GA4_Data tab (every 15 min)
//   2. pullComparisonData()   — current vs previous period totals (on demand,
//                               used by the alert engine)
// =============================================================================

// ── listAllProperties ─────────────────────────────────────────────────────────
// RUN ONCE. Pages through all GA4 properties visible under the logged-in Google
// account via the Admin API and writes PropertyID + DisplayName into Mapping.
function listAllProperties() {
  var ss = getSS();
  var sh = getOrCreateSheet(SHEET_NAMES.MAPPING);

  if (sh.getLastRow() > 1) {
    var ui = SpreadsheetApp.getUi();
    var ans = ui.alert(
      'Mapping tab already has data',
      'This overwrites columns A-B with freshly fetched IDs and names. ' +
      'Columns C-F will also be cleared — re-apply XLOOKUP formulas afterward. Proceed?',
      ui.ButtonSet.YES_NO
    );
    if (ans !== ui.Button.YES) return;
  }

  var rows = [['PropertyID', 'PropertyName', 'Client', 'Owner', 'Tier', 'Vertical']];
  var pageToken = null;
  var count = 0;

  do {
    var params = { pageSize: 200 };
    if (pageToken) params.pageToken = pageToken;
    var page = AnalyticsAdmin.AccountSummaries.list(params);
    (page.accountSummaries || []).forEach(function(acct) {
      (acct.propertySummaries || []).forEach(function(p) {
        var id = String(p.property).split('/').pop();
        rows.push([id, p.displayName || '', '', '', '', '']);
        count++;
      });
    });
    pageToken = page.nextPageToken || null;
  } while (pageToken);

  sh.clearContents();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  SpreadsheetApp.getUi().alert(
    'Done! Found ' + count + ' GA4 properties in Mapping tab.\n\n' +
    'Next:\n' +
    '1. Paste your Monday.com export into the Monday tab.\n' +
    '2. Add XLOOKUP formulas in Mapping D2:F2 (see SETUP.md).\n' +
    '3. Add properties to Site Registry Master (Site_URL, GA4_Property_ID, etc.).'
  );
}

// ── pullChunk ─────────────────────────────────────────────────────────────────
// Time-driven (every 15 min). Writes raw daily metrics to GA4_Data for all
// properties in the registry. Saves a cursor in ScriptProperties so each
// 15-min firing continues where the last one left off. Idles once the daily
// pass is complete.
function pullChunk() {
  var props = PropertiesService.getScriptProperties();
  var tz    = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var cursor = Number(props.getProperty(PROP_KEYS.PULL_CURSOR) || 0);
  if (cursor === 0 && props.getProperty(PROP_KEYS.LAST_PULL_DATE) === today) {
    console.log('Raw data pull already complete for ' + today + ' — idling.');
    return;
  }

  var propIds = getPropertyIdsFromRegistry_();
  if (propIds.length === 0) {
    console.log('No property IDs in registry. Add rows to "' + SHEET_NAMES.REGISTRY + '".');
    return;
  }

  var dataSheet = getOrCreateSheet(SHEET_NAMES.GA4_RAW);
  if (cursor === 0) {
    dataSheet.clearContents();
    dataSheet.getRange(1, 1, 1, 5)
      .setValues([['PropertyID', 'Date', 'Users', 'Sessions', 'Conversions']]);
    console.log('Day ' + today + ': starting raw pull for ' + propIds.length + ' properties.');
  }

  var startedAt = Date.now();
  var rows = [];
  var errors = 0;

  while (cursor < propIds.length && (Date.now() - startedAt) < RUN_BUDGET_MS) {
    try {
      fetchRawProperty_(propIds[cursor], rows);
    } catch (e) {
      logError('pullChunk', e, propIds[cursor]);
      errors++;
    }
    cursor++;
  }

  if (rows.length > 0) {
    dataSheet.getRange(dataSheet.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);
  }

  console.log('Chunk done — cursor: ' + cursor + '/' + propIds.length +
    '  rows: ' + rows.length + '  errors: ' + errors);

  if (cursor >= propIds.length) {
    props.setProperty(PROP_KEYS.LAST_PULL_DATE, today);
    props.deleteProperty(PROP_KEYS.PULL_CURSOR);
    console.log('Raw pull complete for ' + today + '.');
  } else {
    props.setProperty(PROP_KEYS.PULL_CURSOR, String(cursor));
  }
}

// ── pullComparisonData ────────────────────────────────────────────────────────
// Returns current-period vs previous-period aggregated totals for one property.
// window: '7d' (7-day) or '30d' (30-day).
// Makes ONE API call using GA4's multi-date-range feature.
//
// Returns: { current: {sessions:N, totalUsers:N, …}, previous: {…} }
function pullComparisonData(propertyId, window) {
  var is30d = (window === '30d');
  var currentStart  = is30d ? '30daysAgo'  : '7daysAgo';
  var previousStart = is30d ? '60daysAgo'  : '14daysAgo';
  var previousEnd   = is30d ? '31daysAgo'  : '8daysAgo';

  var request = {
    dimensions: [{ name: 'dateRange' }],
    metrics: GA4_METRICS.map(function(m) { return { name: m }; }),
    dateRanges: [
      { startDate: currentStart,  endDate: 'yesterday', name: 'current'  },
      { startDate: previousStart, endDate: previousEnd,  name: 'previous' }
    ],
    keepEmptyRows: false
  };

  var report = AnalyticsData.Properties.runReport(
    request, 'properties/' + propertyId
  );

  var result = { current: null, previous: null };
  (report.rows || []).forEach(function(row) {
    var period = row.dimensionValues[0].value;  // 'current' or 'previous'
    var data = {};
    GA4_METRICS.forEach(function(metric, i) {
      data[metric] = parseFloat(row.metricValues[i].value) || 0;
    });
    result[period] = data;
  });
  return result;
}

// ── Private helpers ───────────────────────────────────────────────────────────

function fetchRawProperty_(propertyId, rows) {
  var request = {
    dateRanges: [{ startDate: LOOKBACK_DAYS + 'daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: [
      { name: 'totalUsers' },
      { name: 'sessions' },
      { name: 'conversions' }
    ],
    limit: 100000
  };
  var report = AnalyticsData.Properties.runReport(
    request, 'properties/' + propertyId
  );
  (report.rows || []).forEach(function(r) {
    var d = r.dimensionValues[0].value;  // "20260610"
    rows.push([
      propertyId,
      d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8),
      Number(r.metricValues[0].value) || 0,
      Number(r.metricValues[1].value) || 0,
      Number(r.metricValues[2].value) || 0
    ]);
  });
}

function getPropertyIdsFromRegistry_() {
  return getRegistryData()
    .map(function(r) { return String(r.property_id).trim(); })
    .filter(function(id) { return id !== ''; });
}
