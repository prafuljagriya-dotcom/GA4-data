// This file is intentionally left minimal.
// The codebase has been reorganised into focused module files:
//
//   00_Config.gs                 — constants, column indices, thresholds
//   01_SheetUtils.gs             — sheet init and read/write helpers
//   02_GA4Fetcher.gs             — listAllProperties, pullChunk, pullComparisonData
//   03_AlertEngine.gs            — evaluateAlerts, writeAlerts
//   04_UptimeMonitor.gs          — UptimeRobot API integration
//   05_NotificationDispatcher.gs — Slack webhook, email, weekly report
//   06_ErrorHandler.gs           — logError, retryWithBackoff
//   07_Main.gs                   — onOpen, setupTriggers, dailyCheck, weeklyCheck
//
// All .gs files share one global scope in Apps Script — no imports needed.
