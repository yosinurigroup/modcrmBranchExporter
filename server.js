// server.js - Webhook server for AppSheet integration
const express = require('express');
const { processBranch } = require('./index');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'ModCRM Webhook Server Running',
        timestamp: new Date().toISOString()
    });
});

// Webhook endpoint for AppSheet
app.post('/webhook/branch-export', async (req, res) => {
    try {
        console.log('Received webhook request from AppSheet');
        console.log('Payload:', JSON.stringify(req.body, null, 2));

        const payload = req.body;

        // Validate required fields
        if (!payload.branchName || !payload.branchId || !payload.customersData) {
            return res.status(400).json({
                error: 'Missing required fields',
                required: ['branchName', 'branchId', 'customersData']
            });
        }

        // Send immediate response to AppSheet (don't make AppSheet wait)
        res.status(202).json({
            status: 'accepted',
            message: 'Branch export started',
            branchName: payload.branchName,
            branchId: payload.branchId,
            timestamp: new Date().toISOString()
        });

        // Process the branch in the background
        processBranch(payload)
            .then(() => {
                console.log('Branch export completed successfully for:', payload.branchName);
            })
            .catch((err) => {
                console.error('Error processing branch:', err);
            });

    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`\n🚀 ModCRM Webhook Server running on port ${PORT}`);
    console.log(`📍 Local URL: http://localhost:${PORT}`);
    console.log(`📥 Webhook endpoint: http://localhost:${PORT}/webhook/branch-export`);
    console.log(`\n⚠️  For AppSheet to access this, you need to:`);
    console.log(`   1. Deploy to a cloud service (Vercel, Heroku, Railway, etc.)`);
    console.log(`   2. Or use ngrok for local testing: npx ngrok http ${PORT}`);
    console.log(`\nPress Ctrl+C to stop the server\n`);
});
