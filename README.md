# ModCRM - AppSheet Integration

## Overview
This project integrates with AppSheet to automatically export branch data, create Google Sheets, and copy customer folders to Google Drive.

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Google OAuth
- Place your `credentials.json` in the project root
- Run the script once to authorize: `node trigger.js`
- Follow the OAuth flow to generate `token.json`

## Running the Webhook Server

### Option 1: Local Testing with ngrok (Fastest)

1. **Start the server:**
```bash
npm start
```

2. **In another terminal, expose it with ngrok:**
```bash
npx ngrok http 3000
```

3. **Copy the ngrok URL** (looks like `https://abc123.ngrok.io`)

4. **AppSheet Webhook URL:**
```
https://your-ngrok-url.ngrok.io/webhook/branch-export
```

### Option 2: Deploy to Railway (Recommended for Production)

1. **Install Railway CLI:**
```bash
npm install -g railway
```

2. **Login to Railway:**
```bash
railway login
```

3. **Initialize and deploy:**
```bash
railway init
railway up
```

4. **Get your public URL:**
```bash
railway domain
```

5. **AppSheet Webhook URL:**
```
https://your-railway-url.railway.app/webhook/branch-export
```

### Option 3: Deploy to Render

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Deploy and get your URL

**AppSheet Webhook URL:**
```
https://your-app-name.onrender.com/webhook/branch-export
```

## AppSheet Configuration

### Webhook Setup

1. In AppSheet, go to **Automation** → **Bots**
2. Create a new bot or edit existing one
3. Add an action: **Call a webhook**
4. Configure the webhook:
   - **URL:** `https://your-deployed-url/webhook/branch-export`
   - **Method:** `POST`
   - **Body:**
   ```json
   {
     "projectsData": 
     [
       <<Start: SELECT(Projects[Project ID],[Branch Name]=[_THISROW].[Dropdown])>>
       {
         "projects" : "<<[Project ID]>>"
       }<<END>>
     ],
     "customersData": [
       <<Start: SELECT(Unique customers[Project ID],[Branch Name]=[_THISROW].[Dropdown])>>
       {
         "fullName": "<<[Customer Name]>>",
         "customerId": "<<[Customer ID]>>",
         "folderlinks" : "<<[Customer ID].[Customer Files]>>"
       }<<END>>
     ],
     "branchName": "<<[Dropdown]>>",
     "branchId" : "<<[dropid]>>"
   }
   ```

### Expected Response
The webhook will return:
```json
{
  "status": "accepted",
  "message": "Branch export started",
  "branchName": "ROMANO- Vardi & Danny",
  "branchId": "6a5f7d0a",
  "timestamp": "2025-11-25T00:20:00.000Z"
}
```

## Testing the Webhook

### Using curl:
```bash
curl -X POST http://localhost:3000/webhook/branch-export \
  -H "Content-Type: application/json" \
  -d '{
    "projectsData": [{"projects": "5CAD3A2C"}],
    "customersData": [{
      "fullName": "Rosie Crittenden",
      "customerId": "CID B6C795C2",
      "folderlinks": "https://drive.google.com/drive/folders/1LcvCdLqIXPy4neQfgZNC5AcqbFaOOnOJ"
    }],
    "branchName": "ROMANO- Vardi & Danny",
    "branchId": "6a5f7d0a"
  }'
```

## Project Structure

```
ModCRM/
├── server.js           # Express webhook server
├── index.js            # Main processing logic
├── trigger.js          # Test script (static payload)
├── credentials.json    # Google OAuth credentials
├── token.json          # Generated OAuth tokens
└── package.json        # Dependencies
```

## Environment Variables (Optional)

You can set these when deploying:

```bash
PORT=3000  # Server port (default: 3000)
```

## Troubleshooting

### Token Expiry
If you get authentication errors, delete `token.json` and run `node trigger.js` to re-authorize.

### ngrok Session Expired
Free ngrok URLs expire after 2 hours. Restart ngrok and update the webhook URL in AppSheet.

### Deployment Issues
Make sure your deployment platform has access to:
- `credentials.json` (add as environment variable or secret)
- `token.json` (generate locally, then upload to deployment)

## Support

For issues, check the logs:
- Local: Check terminal output
- Railway: `railway logs`
- Render: View logs in the Render dashboard
