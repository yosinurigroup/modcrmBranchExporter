require('dotenv').config();
const { Resend } = require('resend');

async function testEmail() {
    console.log('Testing Resend Email...');

    const API_KEY = process.env.RESEND_API_KEY;
    console.log('API Key present:', !!API_KEY);
    if (API_KEY) console.log('API Key length:', API_KEY.length);

    const resend = new Resend(API_KEY);

    // Use the exact values from your .env
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    const toEmail = 'admin@y2kgrouphosting.com'; // Hardcoded for test

    console.log(`Attempting to send from: ${fromEmail}`);
    console.log(`Sending to: ${toEmail}`);

    try {
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: toEmail,
            subject: 'Test Email from ModCRM Debugger',
            html: '<p>If you see this, Resend is working!</p>'
        });

        if (error) {
            console.error('❌ Resend Error:', error);
        } else {
            console.log('✅ Email sent successfully!');
            console.log('Data:', data);
        }
    } catch (err) {
        console.error('❌ Exception:', err);
    }
}

testEmail();
