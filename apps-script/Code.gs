// ─── Configuration ────────────────────────────────────────────────────────────
var SHEET_DATA    = 'GA4_Data';
var SHEET_MAPPING = 'Mapping';
var LOOKBACK_DAYS = 90;             // days of history to (re-)pull on each daily pass
var RUN_BUDGET_MS = 5 * 60 * 1000; // 5-min safety buffer vs the 6-min hard cap
var METRICS = ['totalUsers', 'sessions', 'conversions']; // "conversions" = Key Events in GA4 UI

// ─── Custom menu ──────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GA4 Dashboard')
    .addItem('Step 1 — List all GA4 properties',       'listAllProperties')
    .addSeparator()
    .addItem('Step 2 — Create 15-min auto-trigger',    'createTrigger')
    .addItem('Pull data now (single chunk)',            'pullChunk')
    .addSeparator()
    .addItem('Force full refresh (reset + re-pull)',   'resetAndRerun')
    .addToUi();
}

// ─── listAllProperties ────────────────────────────────────────────────────────
// RUN ONCE. Pages through every GA4 property visible under the logged-in Google
// account via the Admin API and writes PropertyID + DisplayName into the Mapping
// tab.  Columns C-F (Client / Owner / Tier / Vertical) are left blank for the
// XLOOKUP formulas described in SETUP.md.
function listAllProperties() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = getOrCreateSheet_(ss, SHEET_MAPPING);

  if (sh.getLastRow() > 1) {
    var ui = SpreadsheetApp.getUi();
    var ans = ui.alert(
      'Mapping tab already has data',
      'This will overwrite columns A-B with freshly fetched property IDs and names. ' +
      'Columns C-F will also be cleared — you will need to re-apply the XLOOKUP ' +
      'formulas afterward.  Proceed?',
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
        var id = String(p.property).split('/').pop(); // "properties/123456" → "123456"
        rows.push([id, p.displayName || '', '', '', '', '']);
        count++;
      });
    });
    pageToken = page.nextPageToken || null;
  } while (pageToken);

  sh.clearContents();
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);

  SpreadsheetApp.getUi().alert(
    'Done! Found ' + count + ' GA4 properties.\n\n' +
    'Next steps:\n' +
    '1. Paste your Monday.com export into the Monday tab.\n' +
    '2. Add the XLOOKUP formulas in Mapping D2:F2 (see SETUP.md).\n' +
    '3. Run "Step 2 - Create 15-min auto-trigger" from the GA4 Dashboard menu.'
  );
}

// ─── pullChunk ────────────────────────────────────────────────────────────────
// Time-driven (every 15 min). Reads property IDs from Mapping, calls the GA4
// Data API for the last LOOKBACK_DAYS days per property, and appends rows to
// GA4_Data.  A cursor saved in ScriptProperties lets subsequent trigger firings
// continue where the previous run stopped.  Idles once a full daily pass is done.
function pullChunk() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  var tz    = Session.getScriptTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');

  var cursor = Number(props.getProperty('cursor') || 0);

  // Already finished a full pass today — nothing to do until tomorrow.
  if (cursor === 0 && props.getProperty('lastCompletedDate') === today) {
    console.log('Full pass already done for ' + today + ' — idling until tomorrow.');
    return;
  }

  var propIds = getPropertyIds_(ss);
  if (propIds.length === 0) {
    console.log('No property IDs in Mapping tab. Run listAllProperties() first.');
    return;
  }

  var dataSheet = getOrCreateSheet_(ss, SHEET_DATA);

  // First chunk of the day: wipe stale data and write the header row.
  if (cursor === 0) {
    dataSheet.clearContents();
    dataSheet.getRange(1, 1, 1, 5)
      .setValues([['PropertyID', 'Date', 'Users', 'Sessions', 'Conversions']]);
    console.log('Day ' + today + ' — starting fresh pull for ' + propIds.length + ' properties.');
  }

  var startedAt = Date.now();
  var rows      = [];
  var errors    = 0;

  while (cursor < propIds.length && (Date.now() - startedAt) < RUN_BUDGET_MS) {
    try {
      pullOneProperty_(propIds[cursor], rows);
    } catch (err) {
      console.log('SKIP property ' + propIds[cursor] + ': ' + err.message);
      errors++;
    }
    cursor++;
  }

  if (rows.length > 0) {
    dataSheet
      .getRange(dataSheet.getLastRow() + 1, 1, rows.length, rows[0].length)
      .setValues(rows);
  }

  console.log(
    'Chunk done — cursor: ' + cursor + '/' + propIds.length +
    '  rows written: ' + rows.length + '  errors: ' + errors
  );

  if (cursor >= propIds.length) {
    props.setProperty('lastCompletedDate', today);
    props.deleteProperty('cursor');
    console.log('Full daily pass complete for ' + today + '.');
  } else {
    props.setProperty('cursor', String(cursor));
  }
}

// ─── createTrigger ────────────────────────────────────────────────────────────
// RUN ONCE. Removes any existing pullChunk triggers, then registers a new
// every-15-min time-driven trigger.
function createTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(t) { return t.getHandlerFunction() === 'pullChunk'; })
    .forEach(function(t) { ScriptApp.deleteTrigger(t); });

  ScriptApp.newTrigger('pullChunk')
    .timeBased()
    .everyMinutes(15)
    .create();

  SpreadsheetApp.getUi().alert(
    'Trigger created! pullChunk() will now run automatically every 15 minutes.\n\n' +
    'A full pass over ~900 properties will take several hours across multiple chunks. ' +
    'Watch the GA4_Data tab grow.\n\n' +
    'Tip: you can kick off the first chunk immediately via ' +
    '"Pull data now" in the GA4 Dashboard menu.'
  );
}

// ─── resetAndRerun ────────────────────────────────────────────────────────────
// Clears the saved cursor so the next run starts a fresh full pass over all
// properties, then immediately fires the first chunk.
function resetAndRerun() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('cursor');
  props.deleteProperty('lastCompletedDate');
  console.log('Cursor reset — starting fresh pull now.');
  pullChunk();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pullOneProperty_(propertyId, rows) {
  var request = {
    dateRanges: [{ startDate: LOOKBACK_DAYS + 'daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'date' }],
    metrics: METRICS.map(function(m) { return { name: m }; }),
    limit: 100000
  };

  var report = AnalyticsData.Properties.runReport(
    request, 'properties/' + propertyId
  );

  (report.rows || []).forEach(function(r) {
    var d = r.dimensionValues[0].value; // raw format: "20260610"
    rows.push([
      propertyId,
      d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8), // → "2026-06-10"
      Number(r.metricValues[0].value) || 0, // Users
      Number(r.metricValues[1].value) || 0, // Sessions
      Number(r.metricValues[2].value) || 0  // Conversions (= Key Events in the GA4 UI)
    ]);
  });
}

function getPropertyIds_(ss) {
  var sh = ss.getSheetByName(SHEET_MAPPING);
  if (!sh) throw new Error('Missing "' + SHEET_MAPPING + '" tab.');
  var lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, 1).getValues()
    .map(function(r) { return String(r[0]).trim(); })
    .filter(function(id) { return id !== ''; });
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}
