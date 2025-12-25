const fs = require('fs').promises;
const fetch = require('node-fetch');
const pLimit = require('p-limit');
const { google } = require('googleapis');
const { Resend } = require('resend');
const { generateHtmlReport } = require('./htmlGenerator');
const path = require('path');

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';

// ====== CONSTANTS FROM YOUR APPS SCRIPT ======
const PARENT_FOLDER_ID = '14FpsVpcVHyElklst8spOSVmftqch-9eo';
const SOURCE_SHEET_ID = '1M8UpKngr2J24pQ9VmC7pY6PSK_7sXBx4rhNTvCXuS1s'; // contains Projects and Customers data
const PERMITS_SHEET_ID = '1v0mR581oYZyCjoO-yYHDtHFXLC6OXCmVVz1UETL91lc'; // Projects Permits (Source)
const NOTES_SHEET_ID = '1sM4gq9rq0OopT9Kda2k26q_LCsCPl7ox6w2Fz9IZ0hU'; // Notes (Source)
const PROJECT_PRODUCTION_SHEET_ID = '1M8UpKngr2J24pQ9VmC7pY6PSK_7sXBx4rhNTvCXuS1s'; // Project Production (Source)

const CUSTOMER_FINANCE_SHEET_ID = '1FpE891a27W173u45o6N4u9-2X54e_2W_Crr0QOqj7Wc'; // Customer Finance (Source)
const FINANCE_MISSING_DOCS_SHEET_ID = '1v-7yK9d3D4gM3OXtHj65oKyTjH9hP1jQW-T0u3q6G5o'; // Finance Missing Documents (Source)
const VENDOR_INVOICES_SHEET_ID = '1RbssAhXfN1cMqG2M26jhGGHohrBGeWrYZr7hCbUzEzE'; // Vendor Invoices source
const VENDORS_SHEET_ID = '1M8UpKngr2J24pQ9VmC7pY6PSK_7sXBx4rhNTvCXuS1s'; // Vendors source (same as source/prod for now)
const VENDOR_INVOICES_SOURCE_FOLDER_ID = '916bN28uwAXSKAmnMn-q3r4ScqlOwrPYeu'; // Source for PDF uploads
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
    // Helper to fetch sheet data
    const fetchSheet = async (id, range) => {
        try {
            const res = await sheets.spreadsheets.values.get({ spreadsheetId: id, range });
            const values = res.data.values || [];
            return { header: values.length > 0 ? values[0] : [], rows: values.length > 1 ? values.slice(1) : [] };
        } catch (e) {
            console.log(`Note: Sheet ${range} not found or empty in ${id}. Error: ${e.message}`);
            return { header: [], rows: [] };
        }
    };

    // 1. Fetch all raw data
    const projectsRaw = await fetchSheet(SOURCE_SHEET_ID, 'Projects!A1:Z');
    const customersRaw = await fetchSheet(SOURCE_SHEET_ID, 'Customers!A1:Z');
    const mdRaw = await fetchSheet(SOURCE_SHEET_ID, 'Missing Documents!A1:Z');
    const pfRaw = await fetchSheet(SOURCE_SHEET_ID, 'Project Finance!A1:Z');
    const ppRaw = await fetchSheet(SOURCE_SHEET_ID, 'Project Payments!A1:Z');
    const permitsRaw = await fetchSheet(PERMITS_SHEET_ID, 'Projects Permits!A1:Z');
    const notesRaw = await fetchSheet(NOTES_SHEET_ID, 'Notes!A1:Z');
    const prodRaw = await fetchSheet(PROJECT_PRODUCTION_SHEET_ID, 'Project Production!A1:Z');
    const cfRaw = await fetchSheet(CUSTOMER_FINANCE_SHEET_ID, 'Customer Finance!A1:Z');
    const fmdRaw = await fetchSheet(FINANCE_MISSING_DOCS_SHEET_ID, 'Finance Missing Documents!A1:Z');
    const vendorInvoicesRaw = await fetchSheet(VENDOR_INVOICES_SHEET_ID, 'Vendor Invoices!A1:Z');
    const vendorsRaw = await fetchSheet(VENDORS_SHEET_ID, 'Vendors!A1:Z');

    const pHeader = projectsRaw.header;
    const cHeader = customersRaw.header;

    // Extract customer IDs from the payload
    const customerIds = customersData.map(c => c.customerId);
    console.log('Filtering for customer IDs:', customerIds);
    console.log('Filtering for branch name:', branchName);

    // Find the Customer ID and Branch Name column indices in Projects
    const pCustomerIdCol = pHeader.findIndex(h => h && (h.toLowerCase().includes('customer') || h.toLowerCase().includes('cid')));
    const pBranchNameCol = pHeader.findIndex(h => h && h.toLowerCase().includes('branch'));
    const cCustomerIdCol = cHeader.findIndex(h => h && (h.toLowerCase().includes('customer') || h.toLowerCase().includes('cid')));

    // Filter Projects: only rows where customer ID matches AND branch name matches
    const filteredProjects = projectsRaw.rows.filter(row => {
        const rowCustomerId = row[pCustomerIdCol];
        const rowBranchName = row[pBranchNameCol];
        return customerIds.includes(rowCustomerId) && rowBranchName === branchName;
    });

    // Filter Customers: only rows where customer ID matches
    const filteredCustomers = customersRaw.rows.filter(row => {
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
    let filteredProjectPayments = [];
    let filteredProjectsPermits = [];
    let filteredNotes = [];
    let filteredCustomerFinance = [];
    let filteredFinanceMissingDocs = [];

    // Filter Project-related tables
    if (pProjectIdCol !== -1) {
        const validProjectIds = filteredProjects.map(row => row[pProjectIdCol]).filter(id => id);
        console.log(`Found ${validProjectIds.length} valid project IDs for filtering additional sheets.`);

        // 1. Missing Documents (Column B -> index 1)
        if (mdRaw.rows.length > 0) {
            filteredMissingDocs = mdRaw.rows.filter(row => validProjectIds.includes(row[1]));
        }

        // 2. Project Finance (Column C -> index 2)
        if (pfRaw.rows.length > 0) {
            filteredProjectFinance = pfRaw.rows.filter(row => validProjectIds.includes(row[2]));
        }

        // 3. Project Payments (Column D -> index 3)
        if (ppRaw.rows.length > 0) {
            filteredProjectPayments = ppRaw.rows.filter(row => validProjectIds.includes(row[3]));
        }

        // 4. Projects Permits (Column B -> index 1)
        if (permitsRaw.rows.length > 0) {
            filteredProjectsPermits = permitsRaw.rows.filter(row => validProjectIds.includes(row[1]));
        }

        // 5. Notes (Column D -> index 3)
        if (notesRaw.rows.length > 0) {
            filteredNotes = notesRaw.rows.filter(row => validProjectIds.includes(row[3]));
        }
        
        // 6. Project Production
        // We need to find the Project ID column index dynamically or assume standard
        // User didn't specify, but usually Project ID is standard.
        // Let's retry looking for it in header
        const prodPIdIdx = prodRaw.header ? prodRaw.header.findIndex(h => h && (h.toLowerCase().includes('project id') || h.toLowerCase() === 'pid')) : -1;
        if (prodRaw.rows.length > 0 && prodPIdIdx !== -1) {
             filteredProjectProduction = prodRaw.rows.filter(row => validProjectIds.includes(row[prodPIdIdx]));
        }
    }

    // Filter Customer-related tables
    // 7. Customer Finance (Customer ID in Column B -> index 1, Branch in Column D -> index 3)
    if (cfRaw.rows.length > 0) {
        filteredCustomerFinance = cfRaw.rows.filter(row => {
            const cId = row[1];
            const branch = row[3];
            return customerIds.includes(cId) && branch === branchName;
        });
    }

    // 8. Finance Missing Documents (match customerFinanceID in Column C -> index 2)
    let validCustFinIds = [];
    if (filteredCustomerFinance.length > 0) {
        // Assuming the detailed ID is in the first column (index 0) of Customer Finance
        validCustFinIds = filteredCustomerFinance.map(row => row[0]).filter(id => id);
    }

    if (fmdRaw.rows.length > 0 && validCustFinIds.length > 0) {
        filteredFinanceMissingDocs = fmdRaw.rows.filter(row => validCustFinIds.includes(row[2]));
    }

    // --- HELPER: Filter Columns ---
    const filterColumns = (header, rows, removeList) => {
        if (!header) return { header: [], rows: [] };
        const removeSet = new Set(removeList.map(h => h.toLowerCase()));
        
        // Identify indices to keep
        const indicesToKeep = [];
        const newHeader = [];
        header.forEach((h, i) => {
            const hClean = h ? h.toString().trim() : '';
            if (!removeSet.has(hClean.toLowerCase())) {
                indicesToKeep.push(i);
                newHeader.push(hClean);
            }
        });

        const newRows = rows.map(r => indicesToKeep.map(i => r[i]));
        return { header: newHeader, rows: newRows };
    };

    // --- APPLY COLUMN FILTERS (Spreadsheet & HTML) ---

    // 1. PROJECTS: Remove "Last Edit By", "Last Edit On"
    //    We retain Project ID internally (usually first col) if it's not in remove list, 
    //    but user only asked to remove these specific 2.
    const projectsRemove = ["Last Edit By", "Last Edit On", "Project Folder"];
    const cleanProjects = filterColumns(pHeader, filteredProjects, projectsRemove);

    // 2. CUSTOMER FINANCE: Remove customerFinanceID, Customer ID, ProjectID, Branch
    const cfRemove = ["customerFinanceID", "Customer ID", "ProjectID", "Branch"];
    const cleanCF = filterColumns(cfRaw.header, filteredCustomerFinance, cfRemove);

    // 3. PROJECT FINANCE: Remove projectFinanceID, customerFinanceID
    const pfRemove = ["projectFinanceID", "customerFinanceID"];
    const cleanPF = filterColumns(pfRaw.header, filteredProjectFinance, pfRemove);

    // 4. PROJECT PAYMENTS: Remove customerFinanceID, Record ID, Customer
    const ppRemove = ["customerFinanceID", "Record ID", "Customer"];
    const cleanPP = filterColumns(ppRaw.header, filteredProjectPayments, ppRemove);

    // 5. CUSTOMERS: Remove specific columns
    const custRemoveList = ["Customer ID", "Update", "Folder Id", "Last Edit By", "Last Edit On", "Favorit", "Customer Files"];
    const cleanCustomers = filterColumns(cHeader, filteredCustomers, custRemoveList);

    // 6. NOTES (Special handling for HTML vs Sheet)
    const notesRemoveList = [
        "Note ID", "Note Type", "Priority", "ProjectId", "Ticket ID", 
        "Customer", "Department", "Reminder", "Remind to", "Notify on", 
        "Task Date", "Clear", "E2", "E3", "E4", "E5"
    ];
    // For Spreadsheet: Remove ALL
    const sheetNotes = filterColumns(notesRaw.header, filteredNotes, notesRemoveList);
    // For HTML: Keep ProjectId for linking, remove others
    const htmlNotesRemove = notesRemoveList.filter(c => c.toLowerCase() !== 'projectid');
    const htmlNotes = filterColumns(notesRaw.header, filteredNotes, htmlNotesRemove);

    // List of columns to keep for Project Production
    const PROJ_PROD_KEEP = [
        "Job Status", "Vendor", "Equipment Name", "Brand", 
        "Qty", "Watt", "KW", "Permit", 
        "Distance (ft)", "SSA", "Completion", "Final"
    ]; // Note: We do NOT include Project ID in the "Keep" list for the cleaned sheet? 
    // The user said "with following columns only". Typically this means ONLY these. 
    // But if we remove Project ID from the Sheet, they can't link it back manually? 
    // The previous requests removed IDs. So we will REMOVE Project ID from the cleaned sheet.
    
    // Helper to Keep ONLY specified columns
    const keepColumns = (header, rows, columnsToKeep) => {
        if (!header || !rows) return { header: [], rows: [] };
        const indices = [];
        const newHeader = [];
        
        columnsToKeep.forEach(colName => {
            const idx = header.findIndex(h => h && h.trim().toLowerCase() === colName.toLowerCase());
            if (idx !== -1) {
                indices.push(idx);
                newHeader.push(header[idx]);
            }
        });
        
        const newRows = rows.map(r => indices.map(i => r[i]));
        return { header: newHeader, rows: newRows };
    };

    // Filter Vendors Logic
    let filteredVendorInvoices = [];
    let filteredVendors = [];

    // Filter Vendor Invoices by Project ID (Column D -> index 3)
    if (vendorInvoicesRaw.rows.length > 0) {
        // Project ID is in column D (index 3) per user spec
        filteredVendorInvoices = vendorInvoicesRaw.rows.filter(row => {
            const pid = row[3]; 
            // We need validProjectIds from the if(pProjectIdCol !== -1) block. 
            // Recalculating valid IDs here to be safe (safely accessible scope?)
            // We can derive it again from filteredProjects
            const pIdIdx = pHeader ? pHeader.findIndex(h => h && (h.toLowerCase().includes('project id') || h.toLowerCase() === 'id' || h.toLowerCase() === 'pid')) : -1;
            if (pIdIdx === -1) return false;
            const valid = filteredProjects.map(r => r[pIdIdx]).includes(pid);
            return valid;
        });
    }

    // Filter Vendors by Vendor ID (Column A -> index 0) matching Vendor Invoices Vendor (Column B -> index 1)
    if (vendorsRaw.rows.length > 0 && filteredVendorInvoices.length > 0) {
        const activeVendorIds = [...new Set(filteredVendorInvoices.map(row => row[1]))]; // Column B is Vendor
        filteredVendors = vendorsRaw.rows.filter(row => activeVendorIds.includes(row[0])); // Column A is Vendor ID / Name link
        filteredVendors = vendorsRaw.rows.filter(row => activeVendorIds.includes(row[0])); // Column A is Vendor ID / Name link
    }

    const VENDORS_KEEP = [
        "Vendor Name", "Vendor Email", "Vendor Phone", 
        "Vendor Contact Person", "Vendor Address"
    ];
    const sheetVendors = keepColumns(vendorsRaw.header, filteredVendors, VENDORS_KEEP);

    const sheetProd = keepColumns(prodRaw.header, filteredProjectProduction, PROJ_PROD_KEEP);

    console.log(`Filtered: Projects=${cleanProjects.rows.length}, CF=${cleanCF.rows.length}, PF=${cleanPF.rows.length}, PP=${cleanPP.rows.length}, Notes=${filteredNotes.length}, Prod=${sheetProd.rows.length}`);

    return { 
        // Return RAW versions for HTML Generator (preserves IDs and indices for linking)
        pHeader, filteredProjects, 
        cHeader, filteredCustomers, 
        
        mdHeader: mdRaw.header, filteredMissingDocs, 
        
        pfHeader: pfRaw.header, filteredProjectFinance,
        
        cfHeader: cfRaw.header, filteredCustomerFinance,
        
        fmdHeader: fmdRaw.header, filteredFinanceMissingDocs,
        
        ppHeader: ppRaw.header, filteredProjectPayments,
        
        permitsHeader: permitsRaw.header, filteredProjectsPermits,
        
        permitsHeader: permitsRaw.header, filteredProjectsPermits,
        
        prodHeader: prodRaw.header, filteredProjectProduction, // RAW data with IDs for HTML linking

        vendorsHeader: vendorsRaw.header, filteredVendors,
        vendorInvoicesHeader: vendorInvoicesRaw.header, filteredVendorInvoices,
        
        // Return CLEANED versions for Spreadsheet Writer
        sheetProjects: cleanProjects,
        sheetCustomers: cleanCustomers,
        sheetCF: cleanCF,
        sheetPF: cleanPF,
        sheetPP: cleanPP,
        sheetPP: cleanPP,
        sheetProd: sheetProd, // Cleaned for Sheet
        sheetVendors, // Cleaned for Sheet
        
        // Notes handled separately
        sheetNotes,
        htmlNotes,
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
// ====== EMAIL NOTIFICATION ======
async function sendCompletionEmail(branchName, stats, sheetLink, folderLink, errors, recipientEmail, htmlLink) {
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
                
                <div style="text-align: center; margin: 30px 0; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <a href="${sheetLink}" style="background-color: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">View Spreadsheet</a>
                    <a href="${folderLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">View Folder</a>
                    ${htmlLink ? `<a href="${htmlLink}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px; display: inline-block;">View HTML Report</a>` : ''}
                </div>
                
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
    // 2) Create or Overwrite spreadsheet
    // Check if spreadsheet exists
    let newSheetId;
    const existingFiles = await drive.files.list({
        q: `'${branchFolderId}' in parents and name='${branchName} - Projects' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
        fields: 'files(id, name)'
    });

    if (existingFiles.data.files.length > 0) {
        newSheetId = existingFiles.data.files[0].id;
        console.log(`Using existing spreadsheet: ${newSheetId}`);
        // Clear existing sheets content? The writeSheet function overwrites data but doesn't delete sheets.
        // For simplicity, we might want to delete the old file and create new, OR clear it.
        // Given complexity of clearing, deleting and recreating is cleaner for "overwrite" behavior requested.
        await drive.files.delete({ fileId: newSheetId });
        console.log('Deleted old spreadsheet to overwrite.');
        newSheetId = await createSpreadsheet(sheets, `${branchName} - Projects`);
    } else {
        newSheetId = await createSpreadsheet(sheets, `${branchName} - Projects`);
    }

    // Move the new sheet into the branch folder (if strictly new, createSpreadsheet creates in root)
    if (existingFiles.data.files.length === 0 || newSheetId) { 
         // If we deleted and recreated, or created new, we need to move it.
         await drive.files.update({
            fileId: newSheetId,
            addParents: branchFolderId,
            removeParents: 'root',
            fields: 'id'
        });
    }

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
        pfHeader, filteredProjectFinance,
        cfHeader, filteredCustomerFinance,
        fmdHeader, filteredFinanceMissingDocs,
        ppHeader, filteredProjectPayments,
        permitsHeader, filteredProjectsPermits,
        prodHeader, filteredProjectProduction,
        vendorsHeader, filteredVendors,
        vendorInvoicesHeader, filteredVendorInvoices,
        
        // Cleaned sets for Spreadsheet
        // Cleaned sets for Spreadsheet
        sheetProjects, sheetCustomers, sheetCF, sheetPF, sheetPP, sheetProd, sheetNotes,
        sheetVendors,
        
        // HTML specific (notes)
        htmlNotes 
    } = await filterData(drive, sheets, params.customersData, branchName);
    
    // --- PROCESS VENDOR INVOICES UPLOADS ---
    if (vendorInvoicesHeader && filteredVendorInvoices.length > 0) {
        console.log('Processing Vendor Invoice Uploads...');
        const invUploadIdx = vendorInvoicesHeader.findIndex(h => h && h.toLowerCase().trim() === 'invoice upload');
        
        if (invUploadIdx !== -1) {
            // 1. Create Target Folder
            const invoicesFolderId = await getOrCreateFolder(drive, branchFolderId, 'Vendor Invoices', false);
            console.log(`Using Vendor Invoices folder: ${invoicesFolderId}`);

            // 2. Iterate and Copy
            // Use pLimit for concurrency
            const uploadLimit = pLimit(5);
            const uploadTasks = filteredVendorInvoices.map(row => uploadLimit(async () => {
                const rawVal = row[invUploadIdx];
                if (!rawVal || typeof rawVal !== 'string') return;

                // Typical value: /Vendors/Vendor Invoice Uploads/5ddaf79b.Invoice Upload.014443._19244.pdf
                // force split by '/' to handle AppSheet path format regardless of OS
                const filename = rawVal.split('/').pop();
                if (!filename) return; 
                
                // console.log(`Searching for: ${filename}`); // Debug

                try {
                    // Search in Source Folder
                    const q = `'${VENDOR_INVOICES_SOURCE_FOLDER_ID}' in parents and name = '${filename}' and trashed = false`;
                    const res = await drive.files.list({ q, fields: 'files(id, name, webViewLink)' });
                    
                    if (res.data.files.length > 0) {
                        const sourceFile = res.data.files[0];
                        
                        // Check if already copied to destination to avoid duplicates?
                        // For sync efficiency, check overlap.
                        const existQ = `'${invoicesFolderId}' in parents and name = '${filename}' and trashed = false`;
                        const existRes = await drive.files.list({ q: existQ, fields: 'files(id, webViewLink)' });

                        let finalLink = '';
                        if (existRes.data.files.length > 0) {
                           // Exists
                           console.log(`Skipping existing invoice: ${filename}`);
                           finalLink = existRes.data.files[0].webViewLink;
                        } else {
                           // Copy
                           console.log(`Copying invoice: ${filename}`);
                           const copyRes = await drive.files.copy({
                               fileId: sourceFile.id,
                               requestBody: { parents: [invoicesFolderId] },
                               fields: 'id, webViewLink'
                           });
                           finalLink = copyRes.data.webViewLink;
                        }

                        // UPDATE ROW DATA IN PLACE
                        row[invUploadIdx] = finalLink;
                    } else {
                        console.log(`Invoice file not found in source: ${filename}`);
                    }
                } catch (err) {
                    console.error(`Failed to process invoice ${filename}:`, err.message);
                }
            }));
            
            await Promise.all(uploadTasks);
        }
    }


    // Write Cleaned Data to Spreadsheet
    await writeSheet(sheets, newSheetId, 'Projects', sheetProjects.header, sheetProjects.rows);
    await writeSheet(sheets, newSheetId, 'Customers', sheetCustomers.header, sheetCustomers.rows);
    
    if (mdHeader) await writeSheet(sheets, newSheetId, 'Missing Documents', mdHeader, filteredMissingDocs);
    if (sheetPF) await writeSheet(sheets, newSheetId, 'Project Finance', sheetPF.header, sheetPF.rows);
    if (sheetCF) await writeSheet(sheets, newSheetId, 'Customer Finance', sheetCF.header, sheetCF.rows);
    if (fmdHeader) await writeSheet(sheets, newSheetId, 'Finance Missing Documents', fmdHeader, filteredFinanceMissingDocs);
    if (sheetPP) await writeSheet(sheets, newSheetId, 'Project Payments', sheetPP.header, sheetPP.rows);
    if (permitsHeader) await writeSheet(sheets, newSheetId, 'Projects Permits', permitsHeader, filteredProjectsPermits);
    if (sheetProd) await writeSheet(sheets, newSheetId, 'Project Production', sheetProd.header, sheetProd.rows);
    if (sheetVendors) await writeSheet(sheets, newSheetId, 'Vendors', sheetVendors.header, sheetVendors.rows);
    if (vendorInvoicesHeader) await writeSheet(sheets, newSheetId, 'Vendor Invoices', vendorInvoicesHeader, filteredVendorInvoices);
    if (sheetNotes) await writeSheet(sheets, newSheetId, 'Notes', sheetNotes.header, sheetNotes.rows);

    // Remove default blank sheet
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: newSheetId,
        requestBody: {
            requests: [{ deleteSheet: { sheetId: 0 } }]
        }
    });

    // --- GENERATE & UPLOAD HTML REPORT (MOVED UP) ---
    console.log('Generating HTML Report...');
    const htmlContent = generateHtmlReport({
        customers: { header: cHeader, rows: filteredCustomers },
        projects: { header: pHeader, rows: filteredProjects },
        missingDocs: { header: mdHeader, rows: filteredMissingDocs },
        projectFinance: { header: pfHeader, rows: filteredProjectFinance },
        customerFinance: { header: cfHeader, rows: filteredCustomerFinance },
        financeMissingDocs: { header: fmdHeader, rows: filteredFinanceMissingDocs },
        projectPayments: { header: ppHeader, rows: filteredProjectPayments },
        projectsPermits: { header: permitsHeader, rows: filteredProjectsPermits },
        projectProduction: { header: prodHeader, rows: filteredProjectProduction },
        vendors: { header: vendorsHeader, rows: filteredVendors },
        vendorInvoices: { header: vendorInvoicesHeader, rows: filteredVendorInvoices },
        notes: { header: htmlNotes.header, rows: htmlNotes.rows },
        branchName
    });

    // Upload HTML to Drive (Overwrite logic)
    let htmlLink = '';
    try {
        const reportName = `${branchName} - Report.html`;
        const existingReports = await drive.files.list({
             q: `'${branchFolderId}' in parents and name='${reportName}' and trashed=false`,
             fields: 'files(id, name)'
        });
        
        let fileId;
        if (existingReports.data.files.length > 0) {
            console.log(`Overwriting existing HTML report: ${existingReports.data.files[0].id}`);
            fileId = existingReports.data.files[0].id;
            await drive.files.update({
                fileId: fileId,
                media: {
                    mimeType: 'text/html',
                    body: htmlContent
                }
            });
        } else {
            console.log('Creating new HTML report...');
            const fileRes = await drive.files.create({
                resource: {
                    name: reportName,
                    parents: [branchFolderId]
                },
                media: {
                    mimeType: 'text/html',
                    body: htmlContent
                },
                fields: 'id'
            });
            fileId = fileRes.data.id;
        }
        htmlLink = `${HTML_VIEWER_URL}?id=${fileId}`;
        console.log('HTML Report generated:', htmlLink);
    } catch (err) {
        console.error('Failed to create/update HTML report:', err.message);
    }

    // Update AppSheet with HTML Link immediately
    if (htmlLink) {
        await updateAppSheet(branchId, { html: htmlLink });
    }

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

    // 6) Final Update to AppSheet (Summary)
    console.log('Sending summary to AppSheet...');
    await updateAppSheet(branchId, {
        ScriptSummary: summaryText
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
        userEmail,
        htmlLink // Pass new HTML link
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
