// =============================================================================
// MAIN CONTROLLER — menu, triggers, daily/weekly orchestration.
// =============================================================================

// ── Custom menu ───────────────────────────────────────────────────────────────
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GA4 Monitor')
    // ── Setup ──
    .addItem('0 — Initialise all sheets',                  'initAllSheets')
    .addItem('1 — List all GA4 properties → Mapping tab', 'listAllProperties')
    .addSeparator()
    .addItem('2a — Set Slack webhook URL',                 'promptSlackWebhook')
    .addItem('2b — Set alert email address',               'promptAlertEmail')
    .addItem('2c — Set UptimeRobot API key',               'promptUptimeKey')
    .addSeparator()
    .addItem('3 — Create all triggers (run once)',         'setupTriggers')
    .addSeparator()
    // ── Manual runs ──
    .addItem('Run daily alert check NOW (7-day)',          'dailyCheck')
    .addItem('Run weekly report NOW (30-day)',             'weeklyCheck')
    .addItem('Pull raw GA4 data NOW (one chunk)',          'pullChunk')
    .addSeparator()
    .addItem('Force full data refresh (reset cursors)',   'resetAndRerun')
    .addToUi();
}

// ── setupTriggers ─────────────────────────────────────────────────────────────
// RUN ONCE after initial setup. Clears any existing triggers and registers:
//   • pullChunk     — every 15 min  (raw GA4 data)
//   • dailyCheck    — 8 AM daily    (7-day alert comparison + uptime)
//   • weeklyCheck   — Mon 9 AM      (30-day report + weekly email)
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger('pullChunk')
    .timeBased().everyMinutes(15).create();

  ScriptApp.newTrigger('dailyCheck')
    .timeBased().everyDays(1).atHour(8).create();

  ScriptApp.newTrigger('weeklyCheck')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).create();

  SpreadsheetApp.getUi().alert(
    'Triggers created:\n' +
    '• pullChunk    — every 15 min (raw GA4 data)\n' +
    '• dailyCheck   — daily at 8 AM (7-day alerts + uptime)\n' +
    '• weeklyCheck  — Mondays at 9 AM (30-day report)\n\n' +
    'You can also run any of these immediately from this menu.'
  );
}

// ── dailyCheck ────────────────────────────────────────────────────────────────
// Runs every day at 8 AM.
// Compares the last 7 days vs the 7 days before that for all sites.
// Also checks UptimeRobot for site-down / SSL / slow-response alerts.
function dailyCheck() {
  console.log('=== dailyCheck START ' + new Date().toISOString() + ' ===');

  // Reset any stale alert cursor from a previous partial run
  PropertiesService.getScriptProperties().deleteProperty('alert_cursor_7d');

  evaluateAlerts('7d');

  try {
    checkUptimeRobot();
  } catch (e) {
    logError('dailyCheck:uptime', e, '');
  }

  console.log('=== dailyCheck END ===');
}

// ── weeklyCheck ───────────────────────────────────────────────────────────────
// Runs every Monday at 9 AM.
// Compares the last 30 days vs the 30 days before that for all sites.
// Also sends the Monday summary email.
function weeklyCheck() {
  console.log('=== weeklyCheck START ' + new Date().toISOString() + ' ===');

  PropertiesService.getScriptProperties().deleteProperty('alert_cursor_30d');

  evaluateAlerts('30d');
  sendWeeklyReport();

  console.log('=== weeklyCheck END ===');
}

// ── resetAndRerun ─────────────────────────────────────────────────────────────
// Clears all cursors so the next trigger run starts a full fresh pass.
function resetAndRerun() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty(PROP_KEYS.PULL_CURSOR);
  props.deleteProperty(PROP_KEYS.LAST_PULL_DATE);
  props.deleteProperty('alert_cursor_7d');
  props.deleteProperty('alert_cursor_30d');
  console.log('All cursors reset. Kicking off first data chunk now...');
  pullChunk();
}

// ── Config prompts ────────────────────────────────────────────────────────────
// These store sensitive values in ScriptProperties, never in the script source.

function promptSlackWebhook() {
  var ui   = SpreadsheetApp.getUi();
  var resp = ui.prompt(
    'Slack Webhook URL',
    'Paste the incoming webhook URL (starts with https://hooks.slack.com/):',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties()
      .setProperty(PROP_KEYS.SLACK_WEBHOOK, resp.getResponseText().trim());
    ui.alert('Slack webhook URL saved.');
  }
}

function promptAlertEmail() {
  var ui   = SpreadsheetApp.getUi();
  var resp = ui.prompt(
    'Alert Email Address',
    'Enter the email address that should receive Critical alerts and the weekly report:',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties()
      .setProperty(PROP_KEYS.ALERT_EMAIL, resp.getResponseText().trim());
    ui.alert('Alert email address saved.');
  }
}

function promptUptimeKey() {
  var ui   = SpreadsheetApp.getUi();
  var resp = ui.prompt(
    'UptimeRobot Main API Key',
    'Paste your UptimeRobot Main API Key (UptimeRobot → My Settings → API Settings):',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp.getSelectedButton() === ui.Button.OK) {
    PropertiesService.getScriptProperties()
      .setProperty(PROP_KEYS.UPTIME_API_KEY, resp.getResponseText().trim());
    ui.alert('UptimeRobot API key saved.');
  }
}
