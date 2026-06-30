// =============================================================================
// UPTIME MONITOR
//
// Integrates with UptimeRobot (free tier) to pull real-time status for all
// monitored sites. Generates alerts for:
//   • Site down (status 9) or degraded (status 8)
//   • SSL certificate expiring within 7 days (Critical) or 30 days (Warning)
//   • Average response time > 5 seconds (Warning)
//
// To use: set your UptimeRobot Main API key via
//   GA4 Monitor → Set UptimeRobot API key
// =============================================================================

// ── checkUptimeRobot ──────────────────────────────────────────────────────────
function checkUptimeRobot() {
  var apiKey = PropertiesService.getScriptProperties()
    .getProperty(PROP_KEYS.UPTIME_API_KEY);
  if (!apiKey) {
    console.log('UptimeRobot API key not configured — skipping uptime check.');
    return;
  }

  var monitors = fetchUptimeRobotMonitors_(apiKey);
  if (!monitors.length) {
    console.log('No UptimeRobot monitors returned.');
    return;
  }

  var alerts = processMonitors_(monitors);
  if (alerts.length > 0) {
    writeAlerts(alerts);              // shared with AlertEngine
    dispatchAlertNotifications(alerts);
  }

  console.log('Uptime check complete — ' + monitors.length +
    ' monitors, ' + alerts.length + ' alerts.');
}

// ── Private helpers ───────────────────────────────────────────────────────────

function fetchUptimeRobotMonitors_(apiKey) {
  try {
    var resp = UrlFetchApp.fetch('https://api.uptimerobot.com/v2/getMonitors', {
      method:             'post',
      contentType:        'application/x-www-form-urlencoded',
      payload:            'api_key=' + apiKey +
                          '&format=json&response_times=1&ssl=1&all_time_uptime_ratio=1',
      muteHttpExceptions: true
    });
    var data = JSON.parse(resp.getContentText());
    if (data.stat !== 'ok') {
      logError('fetchUptimeRobotMonitors', new Error('UptimeRobot: ' + JSON.stringify(data)), '');
      return [];
    }
    return data.monitors || [];
  } catch (e) {
    logError('fetchUptimeRobotMonitors', e, '');
    return [];
  }
}

function processMonitors_(monitors) {
  var alerts = [];
  var now    = new Date();

  monitors.forEach(function(m) {
    var url = m.url || m.friendly_name || '';

    // ── Site down / degraded ──────────────────────────────────────────────────
    // status: 2 = up, 8 = seems down, 9 = confirmed down
    if (m.status === 9) {
      alerts.push({
        timestamp:   now,
        site_url:    url,
        alert_type:  'SITE_DOWN',
        severity:    'Critical',
        description: 'Site is DOWN' +
                     (m.http_status_code ? ' (HTTP ' + m.http_status_code + ')' : ''),
        metric_value: m.http_status_code || 'N/A',
        threshold:   'HTTP 200',
        status:      'Open',
        assigned_to: '',
        notify:      'Email+Slack'
      });
    } else if (m.status === 8) {
      alerts.push({
        timestamp:   now,
        site_url:    url,
        alert_type:  'SITE_DEGRADED',
        severity:    'Warning',
        description: 'Site appears to be down or intermittently reachable',
        metric_value: 'Degraded',
        threshold:   'Up',
        status:      'Open',
        assigned_to: '',
        notify:      'Slack'
      });
    }

    // ── SSL certificate expiry ────────────────────────────────────────────────
    if (m.ssl && m.ssl.expires) {
      var expiry   = new Date(m.ssl.expires);
      var daysLeft = Math.round((expiry - now) / 86400000);
      if (daysLeft <= 7) {
        alerts.push({
          timestamp:   now,
          site_url:    url,
          alert_type:  'SSL_EXPIRY',
          severity:    'Critical',
          description: 'SSL expires in ' + daysLeft + ' day(s) — ' + m.ssl.expires,
          metric_value: daysLeft + 'd',
          threshold:   '7d',
          status:      'Open',
          assigned_to: '',
          notify:      'Email+Slack'
        });
      } else if (daysLeft <= 30) {
        alerts.push({
          timestamp:   now,
          site_url:    url,
          alert_type:  'SSL_EXPIRY',
          severity:    'Warning',
          description: 'SSL expires in ' + daysLeft + ' day(s) — ' + m.ssl.expires,
          metric_value: daysLeft + 'd',
          threshold:   '30d',
          status:      'Open',
          assigned_to: '',
          notify:      'Slack'
        });
      }
    }

    // ── Slow response time (>5 s) ─────────────────────────────────────────────
    if (m.response_times && m.response_times.length > 0) {
      var total = m.response_times.reduce(function(sum, r) { return sum + r.value; }, 0);
      var avgMs = total / m.response_times.length;
      if (avgMs > 5000) {
        alerts.push({
          timestamp:   now,
          site_url:    url,
          alert_type:  'SLOW_RESPONSE',
          severity:    'Warning',
          description: 'Avg response time ' + (avgMs / 1000).toFixed(1) +
                       's (threshold: 5s)',
          metric_value: Math.round(avgMs) + 'ms',
          threshold:   '5000ms',
          status:      'Open',
          assigned_to: '',
          notify:      'Slack'
        });
      }
    }
  });

  return alerts;
}
