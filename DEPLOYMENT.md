# Render Deployment Guide

## Step 1: Get Base64 Encoded Credentials

Run these commands in your terminal to get the base64 encoded values:

```bash
# Get credentials (copy the output)
cat credentials.json | base64

# Get token (copy the output)
cat token.json | base64
```

**Save these values somewhere safe - you'll need them for Render!**

## Step 2: Push to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: ModCRM Branch Exporter"

# Add remote
git remote add origin https://github.com/yosinurigroup/modcrmBranchExporter.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Deploy to Render

1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select the repository: `yosinurigroup/modcrmBranchExporter`
5. Configure the service:
   - **Name:** `modcrm-branch-exporter` (or your choice)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

6. **Add Environment Variables** (click "Advanced" → "Add Environment Variable"):
   
   Add these three variables:
   
   | Key | Value |
   |-----|-------|
   | `GOOGLE_CREDENTIALS_BASE64` | Paste the base64 output from credentials.json |
   | `GOOGLE_TOKEN_BASE64` | Paste the base64 output from token.json |
   | `PORT` | `3000` |

7. Click **"Create Web Service"**

## Step 4: Get Your Webhook URL

After deployment completes (usually 2-3 minutes):

1. Render will show your service URL (e.g., `https://modcrm-branch-exporter.onrender.com`)
2. Your webhook endpoint will be: `https://modcrm-branch-exporter.onrender.com/webhook/branch-export`

## Step 5: Configure AppSheet

1. In AppSheet, go to **Automation** → **Bots**
2. Create or edit a bot
3. Add action: **Call a webhook**
4. Set URL to: `https://your-app-name.onrender.com/webhook/branch-export`
5. Set Method: **POST**
6. Set Body to the JSON payload (see README.md)

## Testing Your Deployment

Test with curl:

```bash
curl -X POST https://your-app-name.onrender.com/webhook/branch-export \
  -H "Content-Type: application/json" \
  -d '{
    "projectsData": [{"projects": "5CAD3A2C"}],
    "customersData": [{
      "fullName": "Test Customer",
      "customerId": "CID TEST123",
      "folderlinks": "https://drive.google.com/drive/folders/abc123"
    }],
    "branchName": "Test Branch",
    "branchId": "test123"
  }'
```

## Troubleshooting

### Checking Logs
1. In Render dashboard, click on your service
2. Go to **"Logs"** tab
3. Look for errors or confirmation messages

### Common Issues

**"Authorization failed"**
- Check that GOOGLE_CREDENTIALS_BASE64 and GOOGLE_TOKEN_BASE64 are set correctly
- Make sure you used `base64` encoding (not just copy-paste of JSON)

**"Application error"**
- Check Render logs for specific error messages
- Verify all environment variables are set

**Token expired**
- You may need to regenerate token.json locally
- Re-encode it with base64
- Update the GOOGLE_TOKEN_BASE64 environment variable in Render

### Getting New Tokens

If your token expires:
1. Delete local `token.json`
2. Run `node trigger.js` locally
3. Complete OAuth flow
4. Re-encode: `cat token.json | base64`
5. Update `GOOGLE_TOKEN_BASE64` in Render dashboard
6. Restart the service in Render

## Notes

- Render free tier may sleep after 15 minutes of inactivity
- First request after sleep will take ~30 seconds
- Consider upgrading to paid tier for production use
- Keep your base64 credentials secure - never commit them to git!
