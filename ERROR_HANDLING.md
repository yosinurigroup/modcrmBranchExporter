# Error Handling Improvements

## What Changed

We've significantly improved the error handling and resilience of the ModCRM Branch Exporter to handle Google Drive API rate limits and temporary server errors.

## Key Improvements

### 1. **Retry Logic with Exponential Backoff**
- Added `retryWithBackoff()` function that automatically retries failed API calls
- Uses exponential backoff: waits 1s, then 2s, then 4s between retries
- Retries up to 3 times for retryable errors
- Detects retryable errors:
  - HTTP 500 (Internal Server Error)
  - HTTP 503 (Service Unavailable)
  - Rate limit errors
  - Quota exceeded errors
  - Authentication backend unavailable

### 2. **Rate Limiting Protection**
- Added 500ms delay between processing each customer
- This prevents hitting Google Drive API rate limits:
  - 1,000 queries per 100 seconds per user
  - 10,000 queries per 100 seconds per project

### 3. **Graceful Error Recovery**
- Individual customer failures no longer crash the entire batch
- Script continues processing remaining customers even if one fails
- Each customer is wrapped in try-catch block

### 4. **Improved Logging**
- Progress indicator: `[1/150] Processing customer...`
- Success/failure indicators: ✓ and ✗
- Detailed summary at the end showing:
  - Number of customers successfully processed
  - Number of failures
  - List of all errors encountered

### 5. **Better Error Tracking**
- Collects all errors in an array
- Logs errors to Google Sheets for record-keeping
- Returns detailed statistics about the run

## Example Output

```
[1/150] Processing customer: John Smith (abc123)
  ✓ Created customer folder: John Smith
  Copying project folder: Project A (xyz789)
  ✓ Completed customer: John Smith

[2/150] Processing customer: Jane Doe (def456)
  Retrying after 1000ms due to: rate limit exceeded
  ✓ Created customer folder: Jane Doe
  ✗ Error copying project folder abc123: Authentication backend unavailable
  ✓ Completed customer: Jane Doe

========== PROCESSING SUMMARY ==========
✓ Successfully processed: 148 customers
✗ Failed: 2 customers

Errors encountered:
  1. Jeffrey Gerber: Authentication backend unavailable
  2. Manez Preciosa: Internal Server Error
=========================================

✓ Done!
  Spreadsheet: https://docs.google.com/spreadsheets/d/...
  Folder: https://drive.google.com/drive/folders/...
```

## What This Means for You

1. **More Reliable**: Script will automatically retry temporary failures
2. **No Data Loss**: Even if some customers fail, the rest will be processed
3. **Better Visibility**: You'll see exactly what succeeded and what failed
4. **Fewer Manual Reruns**: Most temporary errors will be automatically resolved

## Common Errors (Now Handled Automatically)

| Error | What It Means | How We Handle It |
|-------|--------------|------------------|
| HTTP 500 | Google server error | Retry with exponential backoff |
| Authentication backend unavailable | Google auth service down | Retry up to 3 times |
| Rate limit exceeded | Too many API calls | Delay between customers + retry |
| Quota exceeded | Daily/hourly quota hit | Retry (may need manual intervention) |

## When You Might Still See Errors

- **Permissions Issues**: If you don't have access to a folder
- **Deleted/Missing Files**: If a folder ID in the payload doesn't exist
- **Hard Quota Limits**: If you've completely exhausted daily quotas (rare)

These will be logged in the summary but won't crash the entire batch.
