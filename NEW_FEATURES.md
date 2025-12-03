# New Features: Folder Overwrite & Email Notifications

## Changes Made

### 1. ❌ Removed Date Folder
**Before:** Files were organized like: `Branch Name / 2025-12-03 / Customer Folders`  
**Now:** Files go directly into: `Branch Name / Customer Folders`

This simplifies the folder structure and makes it easier to find files.

### 2. 🔄 Overwrite Existing Files
**Behavior:** When you run the export for the same branch again:
- The branch folder is **completely cleared** first
- All customer folders are **deleted and recreated** fresh
- This prevents duplicate folders and ensures you always have the latest data

**Example:**
First run creates: `ROMANO Branch / John Smith / Project A`  
Second run deletes everything in `ROMANO Branch` first, then recreates it with fresh data.

### 3. 📧 Email Notifications
**Feature:** Automatic email sent when export completes

**Email includes:**
- ✅ Success/failure count
- 📊 Summary statistics
- ⚠️ List of any errors encountered
- 🔗 Direct links to the spreadsheet and folder

**Sample Email:**
```
✓ Branch Export Completed

The export for ROMANO- Vardi & Danny has been completed.

📊 Summary
✓ Successfully processed: 148 customers
✗ Failed: 2 customers

⚠️ Errors Encountered (2)
• Jeffrey Gerber: Authentication backend unavailable
• Manez Preciosa: Internal Server Error

📁 Links
[View Spreadsheet] [View Folder]
```

## Configuration

### Setting Up Email (Gmail Example)

**Important:** The email is sent to the `user` field in the payload. You only need to configure the SMTP credentials, not the recipient.

**Payload includes:**
```json
{
  "branchName": "ROMANO- Vardi & Danny",
  "branchId": "6a5f7d0a",
  "user": "admin@y2kgrouphosting.com",  // ← Email recipient
  "customersData": [...],
  "projectsData": [...]
}
```

1. **Generate App Password (for Gmail):**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Copy the 16-character password

2. **Update .env file:**
```bash
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-app-password
EMAIL_FROM=ModCRM <noreply@yourcompany.com>
# Note: EMAIL_TO is optional - the recipient comes from the payload "user" field
```

3. **Fallback recipient (optional):**
If you want a default recipient when `user` is not in the payload:
```bash
EMAIL_TO=fallback@example.com
```

### Other Email Providers

**Outlook/Office365:**
```bash
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_USER=your-email@outlook.com
EMAIL_PASSWORD=your-password
```

**SendGrid:**
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASSWORD=your-sendgrid-api-key
```

**Custom SMTP:**
```bash
EMAIL_HOST=mail.yourserver.com
EMAIL_PORT=587
EMAIL_USER=your-username
EMAIL_PASSWORD=your-password
```

## Folder Overwrite Behavior

### What Gets Deleted
When you run the export:
1. **Entire branch folder content** is deleted (not the folder itself)
2. **All customer folders** within are removed
3. **The spreadsheet** from previous run is removed

### What Gets Created Fresh
1. New branch folder (if doesn't exist)
2. New spreadsheet with current data
3. Fresh customer folders with latest files

### Safety Notes
⚠️ **Important:**
- The script deletes ALL content in the branch folder before starting
- Make sure you have backed up any important manual edits
- Previous exports are completely replaced, not archived

## Testing Email

To test if email is working, you can check the logs:

**Success:**
```
📧 Completion email sent to recipient@example.com
```

**Not configured:**
```
Email not configured, skipping notification
```

**Error:**
```
Failed to send email: authentication failed
```

## Troubleshooting

### Email Not Sending

1. **Check credentials:**
   - Verify EMAIL_USER and EMAIL_PASSWORD are correct
   - For Gmail, use App Password, not regular password

2. **Check firewall:**
   - Port 587 must be open for SMTP
   - Some networks block SMTP ports

3. **Check logs:**
   - Terminal will show email sending status
   - Look for "Failed to send email" messages

### Overwrite Not Working

If files are duplicating instead of being overwritten:
- Check the logs for "Deleting existing:" messages
- Ensure no permission issues on Google Drive
- Verify the branch name matches exactly

## Benefits

✅ **Cleaner folder structure** - No date-based nesting  
✅ **Always fresh data** - Old files automatically removed  
✅ **Instant notifications** - Know when job completes  
✅ **Error visibility** - See what failed via email  
✅ **Quick access** - Email links go directly to results
