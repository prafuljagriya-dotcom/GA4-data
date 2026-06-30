// =============================================================================
// NOTIFICATION DISPATCHER
//
// Routes alerts to the right channels based on severity and the
// Notification_Method field in Alert Configuration:
//   "Email+Slack" → both channels
//   "Slack"       → Slack only
//   "Email"       → email only
//
// Sensitive config (Slack webhook URL, alert email) is stored via
//   GA4 Monitor → Set Slack webhook URL / Set alert email address
// =============================================================================

// ── dispatchAlertNotifications ────────────────────────────────────────────────
// Called by AlertEngine and UptimeMonitor after writeAlerts().
function dispatchAlertNotifications(alerts) {
  if (!alerts || alerts.length === 0) return;

  var props      = PropertiesService.getScriptProperties();
  var slackUrl   = props.getProperty(PROP_KEYS.SLACK_WEBHOOK);
  var alertEmail = props.getProperty(PROP_KEYS.ALERT_EMAIL);

  var emailAlerts = alerts.filter(function(a) {
    return String(a.notify).indexOf('Email') !== -1;
  });
  var slackAlerts = alerts.filter(function(a) {
    return String(a.notify).indexOf('Slack') !== -1;
  });

  if (emailAlerts.length > 0 && alertEmail) {
    sendEmailAlert_(alertEmail, emailAlerts);
  } else if (emailAlerts.length > 0) {
    console.log('Alert email not configured — skipping email for ' +
      emailAlerts.length + ' alert(s).');
  }

  if (slackAlerts.length > 0 && slackUrl) {
    sendSlackBatch_(slackUrl, slackAlerts);
  } else if (slackAlerts.length > 0) {
    console.log('Slack webhook not configured — skipping Slack for ' +
      slackAlerts.length + ' alert(s).');
  }
}

// ── sendWeeklyReport ──────────────────────────────────────────────────────────
// Sends a plain-text summary email of the past 7 days' alerts.
// Called by weeklyCheck() every Monday at 9 AM.
function sendWeeklyReport() {
  var email = PropertiesService.getScriptProperties()
    .getProperty(PROP_KEYS.ALERT_EMAIL);
  if (!email) {
    console.log('Alert email not configured — skipping weekly report.');
    return;
  }

  var alertsSh = getSheet(SHEET_NAMES.ALERTS_LOG);
  if (!alertsSh || alertsSh.getLastRow() < 2) {
    console.log('Alerts Log is empty — sending empty weekly report.');
  }

  var sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  var allRows = alertsSh && alertsSh.getLastRow() > 1
    ? alertsSh.getRange(2, 1, alertsSh.getLastRow() - 1, 11).getValues()
    : [];

  var weekAlerts = allRows.filter(function(r) {
    return r[0] instanceof Date && r[0] >= sevenDaysAgo;
  });

  var critical = weekAlerts.filter(function(r) { return r[3] === 'Critical'; });
  var warnings  = weekAlerts.filter(function(r) { return r[3] === 'Warning'; });

  var dateStr = new Date().toDateString();
  var subject = '[GA4 Monitor] Weekly Report — ' + dateStr;

  var body  = 'GA4 Monitor — Weekly Summary\n';
  body += 'Week ending: ' + dateStr + '\n';
  body += '============================================================\n\n';
  body += 'ALERT SUMMARY (last 7 days)\n';
  body += '  Critical : ' + critical.length + '\n';
  body += '  Warning  : ' + warnings.length + '\n';
  body += '  Total    : ' + weekAlerts.length + '\n\n';

  if (critical.length > 0) {
    body += 'TOP CRITICAL ALERTS\n';
    body += '--------------------\n';
    critical.slice(0, 15).forEach(function(r) {
      body += '• ' + r[1] + '\n  ' + r[4] + '\n';
    });
    if (critical.length > 15) {
      body += '  ...and ' + (critical.length - 15) + ' more.\n';
    }
    body += '\n';
  }

  if (warnings.length > 0) {
    body += 'WARNINGS\n';
    body += '---------\n';
    warnings.slice(0, 10).forEach(function(r) {
      body += '• ' + r[1] + '\n  ' + r[4] + '\n';
    });
    if (warnings.length > 10) {
      body += '  ...and ' + (warnings.length - 10) + ' more.\n';
    }
    body += '\n';
  }

  body += '------------------------------------------------------------\n';
  body += 'Full details in your Alerts Log sheet.\n';
  body += 'Dashboard: [paste your Looker Studio URL here]\n';

  try {
    MailApp.sendEmail(email, subject, body);
    console.log('Weekly report sent to ' + email);
  } catch (e) {
    logError('sendWeeklyReport', e, '');
  }
}

// ── Private helpers ───────────────────────────────────────────────────────────

function sendEmailAlert_(recipient, alerts) {
  var critical = alerts.filter(function(a) { return a.severity === 'Critical'; });
  var warnings  = alerts.filter(function(a) { return a.severity === 'Warning'; });
  var label     = critical.length > 0 ? 'CRITICAL' : 'WARNING';

  var subject = '[GA4 Monitor] ' + label + ': ' + alerts.length + ' alert(s) — ' +
    new Date().toDateString();

  var body  = 'GA4 Performance Alert\n';
  body += new Date().toLocaleString() + '\n\n';

  if (critical.length > 0) {
    body += '=== CRITICAL (' + critical.length + ') ===\n\n';
    critical.forEach(function(a) {
      body += '• ' + a.site_url + '\n  ' + a.description + '\n\n';
    });
  }
  if (warnings.length > 0) {
    body += '=== WARNING (' + warnings.length + ') ===\n\n';
    warnings.forEach(function(a) {
      body += '• ' + a.site_url + '\n  ' + a.description + '\n\n';
    });
  }

  body += 'Open the Alerts Log sheet for full details and to mark resolved.';

  try {
    MailApp.sendEmail(recipient, subject, body);
    console.log('Email sent to ' + recipient +
      ' (' + critical.length + ' critical, ' + warnings.length + ' warnings)');
  } catch (e) {
    logError('sendEmailAlert', e, '');
  }
}

function sendSlackBatch_(webhookUrl, alerts) {
  var critical = alerts.filter(function(a) { return a.severity === 'Critical'; });
  var warnings  = alerts.filter(function(a) { return a.severity === 'Warning'; });

  var lines = [];
  if (critical.length > 0) {
    lines.push(':red_circle: *' + critical.length + ' Critical alert(s)*');
  }
  if (warnings.length > 0) {
    lines.push(':large_yellow_circle: *' + warnings.length + ' Warning(s)*');
  }
  lines.push('');

  // Top 10 detail lines
  alerts.slice(0, 10).forEach(function(a) {
    var icon = a.severity === 'Critical' ? ':red_circle:' : ':large_yellow_circle:';
    lines.push(icon + ' *' + (a.site_url || 'Unknown') + '*\n   › ' + a.description);
  });
  if (alerts.length > 10) {
    lines.push('_…and ' + (alerts.length - 10) + ' more. Check Alerts Log sheet._');
  }

  var payload = JSON.stringify({
    text: ':rotating_light: *GA4 Monitor Alert* — ' + new Date().toDateString() +
      '\n' + lines.join('\n')
  });

  try {
    UrlFetchApp.fetch(webhookUrl, {
      method:             'post',
      contentType:        'application/json',
      payload:            payload,
      muteHttpExceptions: true
    });
    console.log('Slack notification sent (' + alerts.length + ' alerts).');
  } catch (e) {
    logError('sendSlackBatch', e, '');
  }
}
