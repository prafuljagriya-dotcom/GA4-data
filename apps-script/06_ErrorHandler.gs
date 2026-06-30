// =============================================================================
// ERROR HANDLER — logging and exponential backoff retry wrapper.
// =============================================================================

// Log an error to the Error Log sheet and to the Apps Script execution log.
function logError(functionName, error, propertyId) {
  console.error('[' + functionName + '] property=' + (propertyId || '—') +
    ' | ' + (error.message || String(error)));
  try {
    appendRows(SHEET_NAMES.ERROR_LOG, [[
      new Date(),
      functionName,
      error.message || String(error),
      propertyId || '',
      0,
      false
    ]]);
  } catch (e) {
    // Logging itself failed — write to console only to avoid infinite loop.
    console.error('logError could not write to sheet: ' + e.message);
  }
}

// Retry fn up to maxRetries times with exponential backoff (2 s, 4 s, 8 s …).
// label is used in log output.  Returns fn()'s return value on success.
// Throws the last error if all retries fail.
function retryWithBackoff(fn, maxRetries, label) {
  var attempt = 0;
  while (true) {
    try {
      return fn();
    } catch (e) {
      attempt++;
      if (attempt >= maxRetries) {
        logError(label || 'retryWithBackoff', e, '');
        throw e;
      }
      var delayMs = Math.pow(2, attempt) * 1000;
      console.log('[' + label + '] attempt ' + attempt + '/' + maxRetries +
        ' failed — retrying in ' + delayMs + 'ms');
      Utilities.sleep(delayMs);
    }
  }
}
