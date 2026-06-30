// =============================================================================
// CONFIGURATION
// Edit the values in this file to customise thresholds and sheet names.
// NEVER store secrets here — use the "GA4 Monitor → Set …" menu items which
// write to PropertiesService (encrypted, not visible in the script source).
// =============================================================================

var SHEET_NAMES = {
  REGISTRY:     'Site Registry Master',
  ALERTS_LOG:   'Alerts Log',
  ALERT_CONFIG: 'Alert Configuration',
  PERFORMANCE:  'Performance Metrics',
  ERROR_LOG:    'Error Log',
  GA4_RAW:      'GA4_Data',
  MAPPING:      'Mapping'
};

// 1-based column indices for each sheet — keep in sync with initAllSheets()
var REG_COL = {
  SITE_URL:    1,
  PROPERTY_ID: 2,
  SITE_NAME:   3,
  OWNER:       4,
  CATEGORY:    5,
  PRIORITY:    6,
  STATUS:      7,
  DATE_ADDED:  8,
  NOTES:       9
};

var ALERT_LOG_COL = {
  TIMESTAMP:    1,
  SITE_URL:     2,
  ALERT_TYPE:   3,
  SEVERITY:     4,
  DESCRIPTION:  5,
  METRIC_VALUE: 6,
  THRESHOLD:    7,
  STATUS:       8,
  ASSIGNED_TO:  9,
  NOTES:        10,
  RESOLVED_AT:  11
};

var PERF_COL = {
  DATE:            1,
  PROPERTY_ID:     2,
  SITE_URL:        3,
  OWNER:           4,
  CATEGORY:        5,
  PRIORITY:        6,
  SESSIONS_7D:     7,
  USERS_7D:        8,
  NEW_USERS_7D:    9,
  ENG_RATE_7D:     10,
  CONVS_7D:        11,
  SESSIONS_PREV7:  12,
  SESSIONS_30D:    13,
  SESSIONS_PREV30: 14
};

// GA4 Data API metric names — "conversions" is what GA4 calls "Key Events" in the UI
var GA4_METRICS = ['sessions', 'totalUsers', 'newUsers', 'engagementRate', 'conversions'];

// ScriptProperties keys (never rename these — stored values depend on them)
var PROP_KEYS = {
  SLACK_WEBHOOK:  'SLACK_WEBHOOK_URL',
  ALERT_EMAIL:    'ALERT_EMAIL',
  PULL_CURSOR:    'ga4_pull_cursor',
  LAST_PULL_DATE: 'ga4_last_pull_date',
  UPTIME_API_KEY: 'UPTIMEROBOT_API_KEY'
};

// Processing limits
var RUN_BUDGET_MS  = 5 * 60 * 1000;  // 5-min safety buffer vs the 6-min hard cap
var LOOKBACK_DAYS  = 90;             // raw data window written to GA4_Data
var MAX_RETRIES    = 3;             // exponential backoff attempts per failing call

// Default alert thresholds — seeded into Alert Configuration sheet on first init.
// A negative number means "drop of X%".
var DEFAULT_THRESHOLDS = {
  CRITICAL: -20,  // ≤ -20 % drop
  WARNING:  -15,  // ≤ -15 % drop
  INFO:     -10   // ≤ -10 % drop (dashboard only, no notification)
};
