// =============================================================================
// SHEET UTILITIES — initialisation, read helpers, write helpers.
// =============================================================================

function getSS() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  return getSS().getSheetByName(name);
}

function getOrCreateSheet(name) {
  var ss = getSS();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// Append rows to a sheet, creating it if necessary.
function appendRows(sheetName, rows) {
  if (!rows || rows.length === 0) return;
  var sh = getOrCreateSheet(sheetName);
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

// Read all data rows (skip header row 1) and return as array of plain objects.
// colMap: { FIELD_NAME: 1basedColumnIndex }  →  objects get lowercase field names.
function readSheetRows(sheetName, colMap) {
  var sh = getSheet(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  var numCols = sh.getLastColumn();
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, numCols).getValues();
  return data
    .filter(function(row) { return row.some(function(c) { return c !== ''; }); })
    .map(function(row) {
      var obj = {};
      Object.keys(colMap).forEach(function(field) {
        var colIdx = colMap[field] - 1;  // convert to 0-based
        obj[field.toLowerCase()] = colIdx < row.length ? row[colIdx] : '';
      });
      return obj;
    });
}

// Create all sheets with styled headers and seed Alert Configuration defaults.
function initAllSheets() {
  var headers = {};
  headers[SHEET_NAMES.REGISTRY] = [
    'Site_URL','GA4_Property_ID','Site_Name','Owner','Category','Priority','Status','Date_Added','Notes'
  ];
  headers[SHEET_NAMES.ALERT_CONFIG] = [
    'Metric_Name','Comparison_Window','Threshold_Percent','Severity','Notification_Method','Active'
  ];
  headers[SHEET_NAMES.ALERTS_LOG] = [
    'Timestamp','Site_URL','Alert_Type','Severity','Issue_Description',
    'Metric_Value','Threshold_Breached','Status','Assigned_To','Resolution_Notes','Resolution_Time'
  ];
  headers[SHEET_NAMES.PERFORMANCE] = [
    'Date','Property_ID','Site_URL','Owner','Category','Priority',
    'Sessions_7d','Users_7d','NewUsers_7d','EngRate_7d','Convs_7d',
    'Sessions_Prev7','Sessions_30d','Sessions_Prev30'
  ];
  headers[SHEET_NAMES.ERROR_LOG] = [
    'Timestamp','Function_Name','Error_Message','Property_ID','Retry_Count','Resolved'
  ];
  headers[SHEET_NAMES.GA4_RAW] = [
    'PropertyID','Date','Users','Sessions','Conversions'
  ];
  headers[SHEET_NAMES.MAPPING] = [
    'PropertyID','PropertyName','Client','Owner','Tier','Vertical'
  ];

  var ss = getSS();
  Object.keys(headers).forEach(function(name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      var hdr = headers[name];
      var range = sh.getRange(1, 1, 1, hdr.length);
      range.setValues([hdr]);
      range.setFontWeight('bold');
      range.setBackground('#4a86e8');
      range.setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }
  });

  // Seed Alert Configuration if empty
  var cfgSh = ss.getSheetByName(SHEET_NAMES.ALERT_CONFIG);
  if (cfgSh.getLastRow() < 2) {
    var defaults = [
      ['sessions',       '7d',  -20, 'Critical', 'Email+Slack', true],
      ['sessions',       '7d',  -15, 'Warning',  'Slack',       true],
      ['totalUsers',     '7d',  -20, 'Critical', 'Email+Slack', true],
      ['conversions',    '7d',  -25, 'Critical', 'Email+Slack', true],
      ['engagementRate', '7d',  -20, 'Warning',  'Slack',       true],
      ['sessions',       '30d', -20, 'Critical', 'Email+Slack', true],
      ['sessions',       '30d', -15, 'Warning',  'Slack',       true],
      ['conversions',    '30d', -25, 'Critical', 'Email+Slack', true]
    ];
    cfgSh.getRange(2, 1, defaults.length, defaults[0].length).setValues(defaults);
  }

  SpreadsheetApp.getUi().alert(
    Object.keys(headers).length + ' sheets ready.\n\n' +
    'Next: run "1 — List all GA4 properties" from the GA4 Monitor menu.'
  );
}

// Return all active registry rows as objects (property_id, site_url, owner, etc.)
function getRegistryData() {
  return readSheetRows(SHEET_NAMES.REGISTRY, REG_COL)
    .filter(function(r) {
      return String(r.property_id).trim() !== '' &&
             String(r.status).trim() !== 'Inactive';
    });
}

// Return alert configuration rows for active rules only.
function getAlertConfig() {
  var rows = readSheetRows(SHEET_NAMES.ALERT_CONFIG, {
    METRIC: 1, WINDOW: 2, THRESHOLD: 3, SEVERITY: 4, NOTIFY: 5, ACTIVE: 6
  });
  return rows.filter(function(r) {
    return r.active === true || String(r.active).toUpperCase() === 'TRUE';
  });
}
