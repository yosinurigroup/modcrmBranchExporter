# ModCRM Branch Exporter - Recent Updates

## ✅ All Changes Implemented

### 1. ❌ Removed Date Folder Organization
- **Old behavior:** `Branch Folder / 2025-12-03 / Customer Folders`
- **New behavior:** `Branch Folder / Customer Folders`
- Files now go directly into the branch folder for simpler organization

### 2. 🔄 Automatic Folder Overwrite
- When you run the export for the same branch again:
  - **Old files are automatically deleted**
  - **Folders are recreated fresh** with latest data
  - No more duplicate folders or stale data
- The script cleans up before starting to ensure a fresh export every time

### 3. 📧 Email Notifications on Completion
- Sends a professional HTML email when the job finishes
- **Email includes:**
  - ✓ Success/failure statistics
  - 📊 Total customers processed
  - ⚠️ List of any errors encountered
  - 🔗 Direct links to spreadsheet and folder
- **Completely optional** - only sends if configured

## Quick Setup

### Email Configuration (Optional)

If you want to receive completion emails:

1. **For Gmail users:**
   ```bash
   # Generate App Password at: https://myaccount.google.com/apppasswords
   # Then update .env file:
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-16-char-app-password
   EMAIL_TO=recipient@example.com
   ```

2. **Leave blank to disable:**
   If you don't want emails, just leave `EMAIL_USER` and `EMAIL_TO` empty in `.env`

## Testing

To test the new features:

```bash
node trigger.js
```

**What you'll see:**
1. Branch folder content being deleted (if exists)
2. Individual customer folders being deleted before recreation
3. Progress indicators: `[1/150] Processing customer...`
4. Summary at the end showing success/failure counts
5. Email notification (if configured)

**Sample output:**
```
Using branch folder: abc123xyz...
  Deleting existing: John Smith (folder-id-123)
  Deleting existing: Jane Doe (folder-id-456)
[1/150] Processing customer: John Smith (abc123)
  ✓ Created customer folder: John Smith
  Copying project folder: Project A
  ✓ Completed customer: John Smith

========== PROCESSING SUMMARY ==========
✓ Successfully processed: 148 customers
✗ Failed: 2 customers
=========================================

📧 Completion email sent to recipient@example.com
✓ Done!
```

## Important Notes

⚠️ **Folder Overwrite Warning:**
- Running the export **deletes all content** in the branch folder first
- This ensures clean data but means previous exports are not archived
- Make sure you don't have manual edits in those folders that need to be preserved

✅ **Benefits:**
- Always have the latest, clean data
- No duplicate folders
- Simpler folder structure
- Instant notifications when job completes
- Better visibility into what succeeded/failed

## Files Changed

- `index.js` - Main processing logic updated
- `.env` - Added email configuration
- `.env.example` - Updated with email settings template
- `package.json` - Dependencies (nodemailer added)

## Documentation

- `NEW_FEATURES.md` - Detailed documentation of new features
- `ERROR_HANDLING.md` - Error handling improvements documentation
- `README.md` - Existing general documentation

## Next Steps

1. ✅ Test with `node trigger.js`
2. ⚙️ Configure email (optional) in `.env`
3. 🚀 Deploy to production with updated environment variables
4. 📬 Verify email notifications are working

## Support

If you encounter any issues:
1. Check terminal logs for detailed error messages
2. Review `NEW_FEATURES.md` for configuration help
3. Ensure email credentials are correct (if using email feature)
4. Verify Google Drive permissions are still valid
