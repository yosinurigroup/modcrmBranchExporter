const fs = require('fs').promises;
const fetch = require('node-fetch');
const pLimit = require('p-limit');
const { google } = require('googleapis');
const { Resend } = require('resend');
const { generateHtmlReport } = require('./htmlGenerator');

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';

// ====== CONSTANTS FROM YOUR APPS SCRIPT ======
const PARENT_FOLDER_ID = '14FpsVpcVHyElklst8spOSVmftqch-9eo';
const SOURCE_SHEET_ID = '1M8UpKngr2J24pQ9VmC7pY6PSK_7sXBx4rhNTvCXuS1s'; // contains Projects and Customers data
const LOG_SPREADSHEET_ID = '1M8UpKngr2J24pQ9VmC7pY6PSK_7sXBx4rhNTvCXuS1s';
const APP_ID = 'fea7f1b0-d312-4ae4-a923-aeea438d9ea0';
const ACCESS_KEY = 'V2-ISEP6-P7hiF-OU44l-dWLZH-YYHPd-3fFox-IXJc0-wrnkJ';

// Email configuration (Resend)
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
console.log('DEBUG: Resend API Key loaded:', !!RESEND_API_KEY); // Check if key exists
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev';
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Viewer Script URL for rendering HTML from Drive
const HTML_VIEWER_URL = 'https://script.google.com/macros/s/AKfycbyocD_gE4VKQOyJhy89zn2w90-gwQ-mj75PVO0BlhP8aaS26itrC36ijf1DPUtDlh5j_g/exec';

// ====== HELPER: AUTHORIZATION ======
async function loadCredentials() {
    // Try to load from environment variable first (for deployment)
    if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        const decoded = Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    }
    // Fallback to local file (for development)
    const content = await fs.readFile(CREDENTIALS_PATH);
    return JSON.parse(content);
}

async function loadToken() {
    // Try to load from environment variable first (for deployment)
    if (process.env.GOOGLE_TOKEN_BASE64) {
        const decoded = Buffer.from(process.env.GOOGLE_TOKEN_BASE64, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    }
    // Fallback to local file (for development)
    const content = await fs.readFile(TOKEN_PATH);
    return JSON.parse(content);
}

async function authorize() {
    const credentials = await loadCredentials();
    const clientConfig = credentials.installed || credentials.web;
    const { client_secret, client_id, redirect_uris } = clientConfig;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris ? redirect_uris[0] : 'urn:ietf:wg:oauth:2.0:oob');

    try {
        const token = await loadToken();
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
    } catch (err) {
        return getNewToken(oAuth2Client);
    }
}

async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const code = await new Promise((resolve) => rl.question('Enter the code from that page here: ', resolve));
    rl.close();
    const { tokens } = await oAuth2Client.getToken(code.trim());
    oAuth2Client.setCredentials(tokens);
    await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
    console.log('Token stored to', TOKEN_PATH);
    return oAuth2Client;
}

// ====== DRIVE HELPERS ======
// Limit concurrency of file copies (to avoid Drive API throttling)
const copyLimiter = pLimit(5);

// Helper function to add delay (for rate limiting)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to retry API calls with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const isRetryable =
                error.code === 500 ||
                error.code === 503 ||
                error.message?.includes('rate limit') ||
                error.message?.includes('quota') ||
                error.message?.includes('backend unavailable') ||
                error.message?.includes('Authentication backend');

            if (isRetryable && i < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, i); // Exponential backoff
                console.log(`  Retrying after ${delay}ms due to: ${error.message}`);
                await sleep(delay);
            } else if (!isRetryable) {
                throw error; // Don't retry non-retryable errors
            }
        }
    }
    throw lastError;
}

// Delete all existing folders/files with the given name in the parent
async function deleteExistingFolder(drive, parentId, folderName) {
    const res = await drive.files.list({
        q: `'${parentId}' in parents and name='${folderName}' and trashed=false`,
        fields: 'files(id, name)'
    });

    for (const file of res.data.files) {
        console.log(`  Deleting existing: ${file.name} (${file.id})`);
        await retryWithBackoff(async () => {
            await drive.files.delete({ fileId: file.id });
        });
    }
}

async function getOrCreateFolder(drive, parentId, folderName, deleteExisting = false) {
    // Delete existing folder if requested (for overwrite)
    if (deleteExisting) {
        await deleteExistingFolder(drive, parentId, folderName);
    }

    // Check if folder exists
    const res = await drive.files.list({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1
    });
    if (res.data.files.length > 0) return res.data.files[0].id;

    // Create new folder
    const folder = await drive.files.create({
        resource: {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        },
        fields: 'id'
    });
    return folder.data.id;
}

// Helper to get map of existing files in a folder: name -> id
async function getExistingFilesMap(drive, folderId) {
    const map = new Map();
    let pageToken;
    do {
        const res = await drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageSize: 1000,
            pageToken
        });
        for (const file of res.data.files) {
            map.set(file.name, { id: file.id, mimeType: file.mimeType });
        }
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    return map;
}

async function copyFolderRecursively(drive, sourceId, targetParentId, allowedFolderNames = null, depth = 0, stats = { newFiles: 0, skippedFiles: 0, newFolders: 0, skippedFolders: 0 }) {
    // Get source folder name
    const { data: srcMeta } = await drive.files.get({ fileId: sourceId, fields: 'name' });
    const folderName = srcMeta.name;

    // Only filter subfolders (depth > 0), not the root customer folder (depth = 0)
    if (depth > 0 && allowedFolderNames && allowedFolderNames.length > 0) {
        const isAllowed = allowedFolderNames.some(allowed =>
            folderName.toLowerCase().includes(allowed.toLowerCase()) ||
            allowed.toLowerCase().includes(folderName.toLowerCase())
        );

        if (!isAllowed) {
            console.log(`Skipping subfolder: ${folderName} (not in allowed list)`);
            return null;
        }
    }

    // Check if folder already exists in target
    let newFolderId;
    const existingItemsInTarget = await getExistingFilesMap(drive, targetParentId);
    const existingFolder = existingItemsInTarget.get(folderName);

    if (existingFolder && existingFolder.mimeType === 'application/vnd.google-apps.folder') {
        // Use existing folder
        newFolderId = existingFolder.id;
        stats.skippedFolders++;
        if (depth === 0) console.log(`Using existing customer folder: ${folderName}`);
    } else {
        // Create new folder in target
        const { data: newFolder } = await drive.files.create({
            resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [targetParentId] },
            fields: 'id'
        });
        newFolderId = newFolder.id;
        stats.newFolders++;
        if (depth === 0) console.log(`Created customer folder: ${folderName}`);
    }

    // Get map of what's already inside the destination folder (to skip duplicates)
    const itemsInNewFolder = await getExistingFilesMap(drive, newFolderId);

    // List items in source folder
    let pageToken;
    const copyPromises = [];
    do {
        const res = await drive.files.list({
            q: `'${sourceId}' in parents and trashed=false`,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageSize: 1000,
            pageToken
        });
        for (const file of res.data.files) {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
                // Recursively copy subfolders
                await copyFolderRecursively(drive, file.id, newFolderId, allowedFolderNames, depth + 1, stats);
            } else {
                // Check if file already exists
                if (itemsInNewFolder.has(file.name)) {
                    console.log(`Skipping existing file: ${file.name}`);
                    stats.skippedFiles++;
                } else {
                    // Track the file copy promise
                    stats.newFiles++;
                    copyPromises.push(copyLimiter(() => copyFile(drive, file.id, file.name, newFolderId)));
                }
            }
        }
        pageToken = res.data.nextPageToken;
    } while (pageToken);

    // Wait for all file copies in this folder to complete
    await Promise.all(copyPromises);

    return newFolderId;
}

async function copyFile(drive, fileId, name, parentId) {
    await retryWithBackoff(async () => {
        await drive.files.copy({
            fileId,
            resource: { name, parents: [parentId] },
            fields: 'id'
        });
    });
    console.log(`Copied file: ${name}`);
}

// ====== SPREADSHEET HELPERS ======
async function createSpreadsheet(sheets, title) {
    const res = await sheets.spreadsheets.create({
        requestBody: { properties: { title } },
        fields: 'spreadsheetId'
    });
    return res.data.spreadsheetId;
}

async function writeSheet(sheets, spreadsheetId, sheetName, header, rows) {
    // Add sheet
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
            requests: [{ addSheet: { properties: { title: sheetName } } }]
        }
    });
    // Write values
    const values = [header, ...rows];
    const range = `${sheetName}!A1`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values }
    });
}

async function appendLog(sheets, branchId, sheetLink, folderLink, statusCode, responseText, errorMsg) {
    const now = new Date().toISOString();
    const row = [[now, branchId, sheetLink, folderLink, statusCode, responseText, errorMsg || '']];
    await sheets.spreadsheets.values.append({
        spreadsheetId: LOG_SPREADSHEET_ID,
        range: 'Logs!A1',
        valueInputOption: 'RAW',
        requestBody: { values: row }
    });
}

// ====== DATA FILTERING ======
async function filterData(drive, sheets, customersData, branchName) {
    // Load Projects and Customers data from SOURCE_SHEET_ID
    const projectsRes = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: 'Projects!A1:Z' });
    const customersRes = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: 'Customers!A1:Z' });

    // Load additional sheets: Missing Documents and Project Finance
    let missingDocsRes, projectFinanceRes;
    try {
        missingDocsRes = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: 'Missing Documents!A1:Z' });
    } catch (e) {
        console.log('Note: Missing Documents sheet not found or empty');
        missingDocsRes = { data: { values: [] } };
    }
    try {
        projectFinanceRes = await sheets.spreadsheets.values.get({ spreadsheetId: SOURCE_SHEET_ID, range: 'Project Finance!A1:Z' });
    } catch (e) {
        console.log('Note: Project Finance sheet not found or empty');
        projectFinanceRes = { data: { values: [] } };
    }

    const pRows = projectsRes.data.values || [];
    const cRows = customersRes.data.values || [];
    const mdRows = missingDocsRes.data.values || [];
    const pfRows = projectFinanceRes.data.values || [];

    const pHeader = pRows[0];
    const cHeader = cRows[0];
    const mdHeader = mdRows[0];
    const pfHeader = pfRows[0];

    // Extract customer IDs from the payload
    const customerIds = customersData.map(c => c.customerId);
    console.log('Filtering for customer IDs:', customerIds);
    console.log('Filtering for branch name:', branchName);

    // Find the Customer ID and Branch Name column indices
    const pCustomerIdCol = pHeader.findIndex(h => h && (h.toLowerCase().includes('customer') || h.toLowerCase().includes('cid')));
    const pBranchNameCol = pHeader.findIndex(h => h && h.toLowerCase().includes('branch'));
    const cCustomerIdCol = cHeader.findIndex(h => h && (h.toLowerCase().includes('customer') || h.toLowerCase().includes('cid')));

    // Filter Projects: only rows where customer ID matches AND branch name matches
    const filteredProjects = pRows.slice(1).filter(row => {
        const rowCustomerId = row[pCustomerIdCol];
        const rowBranchName = row[pBranchNameCol];
        return customerIds.includes(rowCustomerId) && rowBranchName === branchName;
    });

    // Filter Customers: only rows where customer ID matches
    const filteredCustomers = cRows.slice(1).filter(row => {
        const rowCustomerId = row[cCustomerIdCol];
        return customerIds.includes(rowCustomerId);
    });

    console.log(`Filtered Projects: ${filteredProjects.length} rows, Customers: ${filteredCustomers.length} rows`);

    // Filter "Missing Documents" and "Project Finance" based on valid Project IDs from the filtered projects
    // First, find the "Project ID" column in the Projects sheet. 
    // We'll look for common names like "Project ID", "ID", or "PID".
    const pProjectIdCol = pHeader ? pHeader.findIndex(h => h && (h.toLowerCase().includes('project id') || h.toLowerCase() === 'id' || h.toLowerCase() === 'pid')) : -1;

    let filteredMissingDocs = [];
    let filteredProjectFinance = [];

    if (pProjectIdCol !== -1) {
        const validProjectIds = filteredProjects.map(row => row[pProjectIdCol]).filter(id => id);
        console.log(`Found ${validProjectIds.length} valid project IDs for filtering additional sheets.`);

        // 1. Missing Documents (matching Project ID from column B -> index 1)
        if (mdRows.length > 1) {
            filteredMissingDocs = mdRows.slice(1).filter(row => {
                const rowPid = row[1]; // Column B
                return validProjectIds.includes(rowPid);
            });
        }

        // 2. Project Finance (matching ProjectID in column C -> index 2)
        if (pfRows.length > 1) {
            filteredProjectFinance = pfRows.slice(1).filter(row => {
                const rowPid = row[2]; // Column C
                return validProjectIds.includes(rowPid);
            });
        }
        
        console.log(`Filtered Missing Documents: ${filteredMissingDocs.length} rows`);
        console.log(`Filtered Project Finance: ${filteredProjectFinance.length} rows`);

    } else {
        console.warn('WARNING: Could not identify "Project ID" column in Projects sheet. Skipping additional sheet filtering.');
    }

    return { 
        pHeader, filteredProjects, 
        cHeader, filteredCustomers, 
        mdHeader, filteredMissingDocs, 
        pfHeader, filteredProjectFinance 
    };
}

// ====== APPSHEET UPDATE ======
async function updateAppSheet(branchId, updates) {
    const payload = {
        Action: 'Edit',
        Properties: {
            Locale: 'en-US',
            Timezone: 'UTC'
        },
        Rows: [{
            dropid: branchId,
            ...updates
        }]
    };
    const url = `https://api.appsheet.com/api/v2/apps/${APP_ID}/tables/Dropdowns/Action?applicationAccessKey=${ACCESS_KEY}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const text = await resp.text();
    return { statusCode: resp.status, responseText: text };
}

// ====== EMAIL NOTIFICATION ======
async function sendCompletionEmail(branchName, stats, sheetLink, folderLink, errors, recipientEmail) {
    // Skip if Resend not configured
    if (!resend || !recipientEmail) {
        console.log('Email not configured or no recipient specified, skipping notification');
        return;
    }

    const errorSection = errors.length > 0 ? `
    <h3 style="color: #d9534f;">⚠️ Errors Encountered (${errors.length})</h3>
    <ul>
    ${errors.map(e => `<li><strong>${e.customer || 'Unknown'}</strong>: ${e.error}</li>`).join('')}
    </ul>
    ` : '';

    try {
        const { data, error } = await resend.emails.send({
            from: EMAIL_FROM,
            to: recipientEmail,
            subject: `✓ ModCRM Export Complete: ${branchName}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #5cb85c;">✓ Branch Export Completed</h2>
                <p>The export for <strong>${branchName}</strong> has been completed.</p>
                
                <h3>📊 Summary</h3>
            <ul>
                <li>✓ Successfully processed: <strong>${stats.successCount}</strong> customers</li>
                <li>✗ Failed: <strong>${stats.errorCount}</strong> customers</li>
                <li>⏱️ Duration: <strong>${stats.duration}</strong></li>
                <li>🕒 Completed: <strong>${stats.completionTime}</strong></li>
            </ul>
            
            <h3>📂 File Stats</h3>
            <ul>
                <li>📄 New Files Added: <strong>${stats.newFiles}</strong></li>
                <li>⏩ Existing Files Skipped: <strong>${stats.skippedFiles}</strong></li>
                <li>📁 New Folders Created: <strong>${stats.newFolders}</strong></li>
            </ul>
                
                ${errorSection}
                
                <h3>📁 Links</h3>
                <p>
                    <a href="${sheetLink}" style="display: inline-block; padding: 10px 20px; background-color: #5cb85c; color: white; text-decoration: none; border-radius: 5px; margin-right: 10px;">View Spreadsheet</a>
                    <a href="${folderLink}" style="display: inline-block; padding: 10px 20px; background-color: #0275d8; color: white; text-decoration: none; border-radius: 5px;">View Folder</a>
                </p>
                <p style="font-size: 12px; color: #666;">
                    Spreadsheet: <a href="${sheetLink}">${sheetLink}</a><br>
                    Folder: <a href="${folderLink}">${folderLink}</a>
                </p>
                
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">Generated by ModCRM Branch Exporter at ${new Date().toLocaleString()}</p>
            </div>
            `
        });

        if (error) {
            console.error('Failed to send email:', error.message);
        } else {
            console.log(`📧 Completion email sent to ${recipientEmail}`);
        }
    } catch (error) {
        console.error('Failed to send email:', error.message);
    }
}

// ====== MAIN FUNCTION ======
async function processBranch(params) {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    const branchName = params.branchName;
    const branchId = params.branchId;
    // Use payload user OR hardcoded admin email
    const userEmail = params.user || 'admin@y2kgrouphosting.com';

    const startTime = new Date();
    console.log(`Starting export for branch: ${branchName} at ${startTime.toLocaleTimeString()}`);
    console.log(`Notification will be sent to: ${userEmail}`);

    // 1) Create/get branch folder (INCREMENTAL SYNC: do NOT delete existing)
    const branchFolderId = await getOrCreateFolder(drive, PARENT_FOLDER_ID, branchName, false);
    console.log(`Using branch folder: ${branchFolderId}`);

    // 2) Create new spreadsheet
    const newSheetId = await createSpreadsheet(sheets, `${branchName} - Projects`);
    // Move the new sheet into the branch folder
    await drive.files.update({
        fileId: newSheetId,
        addParents: branchFolderId,
        removeParents: 'root',
        fields: 'id'
    });

    // PREPARE LINKS
    const sheetLink = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;
    const folderLink = `https://drive.google.com/drive/folders/${branchFolderId}`;

    // 3) IMMEDIATE UPDATE TO APPSHEET (Links)
    console.log('Sending links to AppSheet...');
    await updateAppSheet(branchId, {
        BranchSheet: sheetLink,
        BranchData: folderLink,
        ScriptSummary: 'Processing started...'
    });

    // 4) Filter and write data
    const { 
        pHeader, filteredProjects, 
        cHeader, filteredCustomers,
        mdHeader, filteredMissingDocs,
        pfHeader, filteredProjectFinance
    } = await filterData(drive, sheets, params.customersData, branchName);
    
    await writeSheet(sheets, newSheetId, 'Projects', pHeader, filteredProjects);
    await writeSheet(sheets, newSheetId, 'Customers', cHeader, filteredCustomers);
    
    if (mdHeader && mdHeader.length > 0) {
        await writeSheet(sheets, newSheetId, 'Missing Documents', mdHeader, filteredMissingDocs);
    }
    if (pfHeader && pfHeader.length > 0) {
        await writeSheet(sheets, newSheetId, 'Project Finance', pfHeader, filteredProjectFinance);
    }

    // Remove default blank sheet
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: newSheetId,
        requestBody: {
            requests: [{ deleteSheet: { sheetId: 0 } }]
        }
    });

    // 4) Extract project folder IDs from projectsData URLs and map to Customer IDs
    const projectFoldersByCustomer = {};

    if (params.projectsData && params.projectsData.length > 0) {
        params.projectsData.forEach(p => {
            if (p.projectFolders && p.customerId) {
                const match = /\/folders\/([a-zA-Z0-9_-]+)/.exec(p.projectFolders);
                if (match) {
                    const folderId = match[1];
                    if (!projectFoldersByCustomer[p.customerId]) {
                        projectFoldersByCustomer[p.customerId] = [];
                    }
                    projectFoldersByCustomer[p.customerId].push(folderId);
                }
            }
        });
    }

    console.log('Project folders mapped by customer:', JSON.stringify(projectFoldersByCustomer, null, 2));

    // 5) Copy each customer folder
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    const syncStats = { newFiles: 0, skippedFiles: 0, newFolders: 0, skippedFolders: 0 };

    if (params.customersData) {
        for (let i = 0; i < params.customersData.length; i++) {
            const cust = params.customersData[i];
            const link = cust.folderlinks || cust.folderlink;

            if (link) {
                const match = /\/folders\/([a-zA-Z0-9_-]+)/.exec(link);
                if (match) {
                    const sourceCustFolderId = match[1]; // Renamed to avoid conflict with new custFolderId
                    console.log(`[${i + 1}/${params.customersData.length}] Processing customer: ${cust.fullName} (Source ID: ${sourceCustFolderId})`);

                    try {
                        // INCREMENTAL SYNC: Do NOT delete existing customer folder
                        // await deleteExistingFolder(drive, branchFolderId, cust.fullName);

                        // Copy/Sync customer folder
                        // We use copyFolderRecursively which now handles "get or create" logic internally
                        // But wait, copyFolderRecursively takes a SOURCE ID.
                        // Here we are creating the ROOT customer folder which doesn't have a single source ID
                        // because we are copying multiple project folders INTO it.

                        // So first, ensure customer folder exists
                        const custFolderId = await getOrCreateFolder(drive, branchFolderId, cust.fullName, false);
                        console.log(`  ✓ Customer folder ready: ${cust.fullName} (Target ID: ${custFolderId})`);

                        // Get project folders specifically for this customer
                        const customerProjectFolders = projectFoldersByCustomer[cust.customerId] || [];

                        // Copy only the project folders (by ID) for this customer
                        if (customerProjectFolders.length > 0) {
                            for (const projFolderId of customerProjectFolders) {
                                try {
                                    // Get folder metadata with retry
                                    const projMeta = await retryWithBackoff(async () => {
                                        const result = await drive.files.get({
                                            fileId: projFolderId,
                                            fields: 'name'
                                        });
                                        return result.data;
                                    });

                                    console.log(`  Syncing project folder: ${projMeta.name} (Source ID: ${projFolderId})`);
                                    await copyFolderRecursively(drive, projFolderId, custFolderId, null, 0, syncStats);

                                } catch (err) {
                                    console.log(`  ✗ Error copying project folder ${projFolderId}: ${err.message}`);
                                    errors.push({ customer: cust.fullName, projectFolder: projFolderId, error: err.message });
                                }
                            }
                        } else {
                            // No project folders specified for this customer, copy everything from their root folder
                            console.log(`  No specific project folders found for ${cust.customerId}, copying all subfolders`);
                            await copyFolderRecursively(drive, custFolderId, newCustFolder.id, null, 1);
                        }

                        successCount++;
                        console.log(`  ✓ Completed customer: ${cust.fullName}\n`);

                    } catch (err) {
                        errorCount++;
                        const errorMsg = `Failed to process customer ${cust.fullName}: ${err.message}`;
                        console.error(`  ✗ ${errorMsg}\n`);
                        errors.push({ customer: cust.fullName, error: err.message });
                    }

                    // Add delay between customers to avoid rate limiting (except for last customer)
                    if (i < params.customersData.length - 1) {
                        await sleep(500); // 500ms delay between customers
                    }
                }
            }
        }
    }

    // Wait for any outstanding file copies to finish
    await copyLimiter(() => Promise.resolve());

    // Log summary
    console.log('\n========== PROCESSING SUMMARY ==========');
    console.log(`✓ Successfully processed: ${successCount} customers`);
    console.log(`✗ Failed: ${errorCount} customers`);
    if (errors.length > 0) {
        console.log('\nErrors encountered:');
        errors.forEach((err, idx) => {
            console.log(`  ${idx + 1}. ${err.customer}: ${err.error}`);
        });
    }
    console.log('=========================================\n');

    // Calculate duration
    const endTime = new Date();
    const durationMs = endTime - startTime;
    const durationMin = Math.floor(durationMs / 60000);
    const durationSec = ((durationMs % 60000) / 1000).toFixed(0);
    const durationStr = `${durationMin}m ${durationSec}s`;
    const completionTimeStr = endTime.toLocaleString();

    // Generate Summary String
    const summaryText = `Completed: ${successCount} success, ${errorCount} failed. Added ${syncStats.newFiles} files, skipped ${syncStats.skippedFiles}. Duration: ${durationStr}. ${errors.length > 0 ? 'Errors: ' + errors.map(e => e.customer).join(', ') : ''}`;

    // Generate HTML Report
    const htmlContent = generateHtmlReport({
        customers: { header: cHeader, rows: filteredCustomers },
        projects: { header: pHeader, rows: filteredProjects },
        missingDocs: { header: mdHeader, rows: filteredMissingDocs },
        projectFinance: { header: pfHeader, rows: filteredProjectFinance },
        branchName
    });

    // Upload HTML to Drive
    let htmlLink = '';
    try {
        const fileRes = await drive.files.create({
            resource: {
                name: `${branchName} - Report.html`,
                parents: [branchFolderId]
            },
            media: {
                mimeType: 'text/html',
                body: htmlContent
            },
            fields: 'webViewLink, id'
        });
        
        // Construct the proxy viewer link
        const fileId = fileRes.data.id;
        htmlLink = `${HTML_VIEWER_URL}?id=${fileId}`;
        
        console.log('HTML Report generated:', htmlLink);
    } catch (err) {
        console.error('Failed to create HTML report:', err.message);
    }

    // 6) Final Update to AppSheet (Summary + HTML Link)
    console.log('Sending summary to AppSheet...');
    const apiResult = await updateAppSheet(branchId, {
        ScriptSummary: summaryText,
        html: htmlLink
    });

    // 7) Log the attempt (include error summary)
    const errorSummary = errors.length > 0 ? `Errors: ${errors.length}` : '';
    await appendLog(sheets, branchId, sheetLink, folderLink, apiResult.statusCode, apiResult.responseText, errorSummary);

    console.log('✓ Done!');
    console.log('  Spreadsheet:', sheetLink);
    console.log('  Folder:', folderLink);
    console.log(`  Duration: ${durationStr}`);
    console.log(`  Stats: ${syncStats.newFiles} new files, ${syncStats.skippedFiles} skipped`);

    // 8) Send completion email
    await sendCompletionEmail(
        branchName,
        {
            successCount,
            errorCount,
            duration: durationStr,
            completionTime: completionTimeStr,
            newFiles: syncStats.newFiles,
            skippedFiles: syncStats.skippedFiles,
            newFolders: syncStats.newFolders
        },
        sheetLink,
        folderLink,
        errors,
        userEmail
    );

    return {
        success: true,
        sheetLink,
        folderLink,
        stats: { successCount, errorCount, errors }
    };
}

// Example invocation:
// Adjust these parameters to match your incoming payload
// const exampleParams = {
//     branchName: 'ROMANO- Vardi & Danny',
//     branchId: '6a5f7d0a',
//     projectsData: [],    // not used in this sample; filtering uses the whole sheet
//     customersData: [
//         { fullName: 'Rosie Crittenden', customerId: 'CID B6C795C2', folderlinks: 'https://drive.google.com/drive/folders/1LcvCdLqIXPy4neQfgZNC5AcqbFaOOnOJ' },
//         { fullName: 'Dorothy Caldwell', customerId: 'CID 014CE6CB', folderlinks: 'https://drive.google.com/drive/folders/1h4pvHha4P7XyRZqtUEFH8A2IdoYAzTtN' }
//         // …add more customer objects as needed
//     ]
// };

// processBranch(exampleParams).catch((err) => console.error(err));
module.exports = { processBranch };
