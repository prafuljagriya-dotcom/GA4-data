// =============================================================================
// ALERT ENGINE
//
// evaluateAlerts(window) is the main entry point.
// It pulls comparison data for every active registry site, evaluates each
// metric against the configured thresholds, writes matching alerts to the
// Alerts Log sheet, and hands them off to the notification dispatcher.
// =============================================================================

// ── evaluateAlerts ────────────────────────────────────────────────────────────
// window: '7d' (called by dailyCheck) or '30d' (called by weeklyCheck).
function evaluateAlerts(window) {
  var registry = getRegistryData();
  if (registry.length === 0) {
    console.log('evaluateAlerts: no active sites in registry — skipping.');
    return;
  }

  var config = getAlertConfig().filter(function(c) {
    return String(c.window).trim() === window;
  });
  if (config.length === 0) {
    console.log('evaluateAlerts: no active rules for window=' + window + '.');
    return;
  }

  var props     = PropertiesService.getScriptProperties();
  var cursorKey = 'alert_cursor_' + window;
  var cursor    = Number(props.getProperty(cursorKey) || 0);
  var startedAt = Date.now();
  var allAlerts = [];
  var errors    = 0;

  console.log('Alert check (' + window + ') — sites: ' + registry.length +
    ', cursor: ' + cursor + ', rules: ' + config.length);

  while (cursor < registry.length && (Date.now() - startedAt) < RUN_BUDGET_MS) {
    var site = registry[cursor];
    try {
      var comparison = pullComparisonData(String(site.property_id).trim(), window);
      var siteAlerts = evaluateSite_(site, comparison, config);
      allAlerts = allAlerts.concat(siteAlerts);
    } catch (e) {
      logError('evaluateAlerts', e, String(site.property_id));
      errors++;
    }
    cursor++;
  }

  if (allAlerts.length > 0) {
    writeAlerts(allAlerts);
    dispatchAlertNotifications(allAlerts);
  }

  console.log('Alert check done — cursor: ' + cursor + '/' + registry.length +
    '  alerts: ' + allAlerts.length + '  errors: ' + errors);

  if (cursor >= registry.length) {
    props.deleteProperty(cursorKey);
    console.log('Alert pass complete (' + window + ').');
  } else {
    // Time budget exceeded — save progress. pullChunk will resume on next firing.
    props.setProperty(cursorKey, String(cursor));
    console.log('Alert pass paused at cursor ' + cursor + ' — will resume next trigger run.');
  }
}

// ── writeAlerts ───────────────────────────────────────────────────────────────
// Shared by AlertEngine and UptimeMonitor. Converts alert objects to sheet rows.
function writeAlerts(alerts) {
  var rows = alerts.map(function(a) {
    return [
      a.timestamp  || new Date(),
      a.site_url   || '',
      a.alert_type || '',
      a.severity   || '',
      a.description || '',
      String(a.metric_value !== undefined ? a.metric_value : ''),
      String(a.threshold    !== undefined ? a.threshold    : ''),
      a.status      || 'Open',
      a.assigned_to || '',
      '',   // Resolution_Notes — filled manually
      ''    // Resolution_Time  — filled manually
    ];
  });
  appendRows(SHEET_NAMES.ALERTS_LOG, rows);
}

// ── Private helpers ───────────────────────────────────────────────────────────

function evaluateSite_(site, comparison, config) {
  var alerts  = [];
  var current  = comparison.current;
  var previous = comparison.previous;

  if (!current || !previous) return alerts;

  config.forEach(function(rule) {
    var metric    = String(rule.metric).trim();
    var threshold = parseFloat(rule.threshold);
    var cur  = current[metric]  || 0;
    var prev = previous[metric] || 0;

    if (prev === 0) return;  // no baseline — skip

    var pctChange = ((cur - prev) / prev) * 100;

    if (pctChange <= threshold) {
      var direction = pctChange < 0 ? 'dropped' : 'changed';
      alerts.push({
        timestamp:    new Date(),
        site_url:     site.site_url   || '',
        property_id:  site.property_id || '',
        alert_type:   'GA4_METRIC_DROP',
        severity:     rule.severity,
        description:  metric + ' ' + direction + ' ' +
                      Math.abs(pctChange).toFixed(1) + '% ' +
                      '(' + Math.round(prev) + ' → ' + Math.round(cur) +
                      ' over ' + rule.window + ')',
        metric_value: cur.toFixed(metric === 'engagementRate' ? 4 : 0),
        threshold:    threshold + '%',
        status:       'Open',
        assigned_to:  site.owner || '',
        notify:       String(rule.notify),
        pct_change:   pctChange
      });
    }
  });

  return alerts;
}
