const fs = require('fs').promises;
const fetch = require('node-fetch');
const pLimit = require('p-limit');
const { google } = require('googleapis');

const CREDENTIALS_PATH = 'credentials.json';
const TOKEN_PATH = 'token.json';

// ====== CONSTANTS FROM YOUR APPS SCRIPT ======
const PARENT_FOLDER_ID = '14FpsVpcVHyElklst8spOSVmftqch-9eo';
const SOURCE_SHEET_ID = '1M8UpKngr2J24pQ9VmC7pY6PSK_7sXBx4rhNTvCXuS1s'; // contains Projects and Customers data
const LOG_SPREADSHEET_ID = '1M8UpKngr2J24pQ9VmC7pY6PSK_7sXBx4rhNTvCXuS1s';
const APP_ID = 'fea7f1b0-d312-4ae4-a923-aeea438d9ea0';
const ACCESS_KEY = 'V2-ISEP6-P7hiF-OU44l-dWLZH-YYHPd-3fFox-IXJc0-wrnkJ';

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

async function getOrCreateFolder(drive, parentId, folderName) {
    const res = await drive.files.list({
        q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1
    });
    if (res.data.files.length > 0) return res.data.files[0].id;

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

async function copyFolderRecursively(drive, sourceId, targetParentId, allowedFolderNames = null, depth = 0) {
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

    // Create new folder in target
    const { data: newFolder } = await drive.files.create({
        resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder', parents: [targetParentId] },
        fields: 'id'
    });
    const newFolderId = newFolder.id;

    if (depth === 0) {
        console.log(`Copying customer folder: ${folderName}`);
    }

    // List items in source folder
    let pageToken;
    do {
        const res = await drive.files.list({
            q: `'${sourceId}' in parents and trashed=false`,
            fields: 'nextPageToken, files(id, name, mimeType)',
            pageSize: 1000,
            pageToken
        });
        for (const file of res.data.files) {
            if (file.mimeType === 'application/vnd.google-apps.folder') {
                // Recursively copy subfolders with increased depth
                await copyFolderRecursively(drive, file.id, newFolderId, allowedFolderNames, depth + 1);
            } else {
                copyLimiter(() => copyFile(drive, file.id, file.name, newFolderId));
            }
        }
        pageToken = res.data.nextPageToken;
    } while (pageToken);
    return newFolderId;
}

async function copyFile(drive, fileId, name, parentId) {
    await drive.files.copy({
        fileId,
        resource: { name, parents: [parentId] },
        fields: 'id'
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

    const pRows = projectsRes.data.values || [];
    const cRows = customersRes.data.values || [];

    const pHeader = pRows[0];
    const cHeader = cRows[0];

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

    return { pHeader, filteredProjects, cHeader, filteredCustomers };
}

// ====== APPSHEET UPDATE ======
async function updateAppSheet(branchId, sheetLink, folderLink) {
    const payload = {
        Action: 'Edit',
        Rows: [{
            dropid: branchId,
            BranchSheet: sheetLink,
            BranchData: folderLink
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

// ====== MAIN FUNCTION ======
async function processBranch(params) {
    const auth = await authorize();
    const drive = google.drive({ version: 'v3', auth });
    const sheets = google.sheets({ version: 'v4', auth });

    const branchName = params.branchName;
    const branchId = params.branchId;
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1) Create branch and date folders
    const branchFolderId = await getOrCreateFolder(drive, PARENT_FOLDER_ID, branchName);
    const dateFolderId = await getOrCreateFolder(drive, branchFolderId, dateStr);
    console.log(`Using folders: ${branchFolderId} -> ${dateFolderId}`);

    // 2) Create new spreadsheet
    const newSheetId = await createSpreadsheet(sheets, `${branchName} - Projects`);
    // Move the new sheet into the date folder
    await drive.files.update({
        fileId: newSheetId,
        addParents: dateFolderId,
        removeParents: 'root',
        fields: 'id'
    });

    // 3) Filter and write data
    const { pHeader, filteredProjects, cHeader, filteredCustomers } = await filterData(drive, sheets, params.customersData, branchName);
    await writeSheet(sheets, newSheetId, 'Projects', pHeader, filteredProjects);
    await writeSheet(sheets, newSheetId, 'Customers', cHeader, filteredCustomers);

    // Remove default blank sheet
    await sheets.spreadsheets.batchUpdate({
        spreadsheetId: newSheetId,
        requestBody: {
            requests: [{ deleteSheet: { sheetId: 0 } }]
        }
    });

    // 4) Extract project folder IDs from projectsData URLs
    const projectFolderIds = [];
    if (params.projectsData && params.projectsData.length > 0) {
        params.projectsData.forEach(p => {
            if (p.projectFolders) {
                const match = /\/folders\/([a-zA-Z0-9_-]+)/.exec(p.projectFolders);
                if (match) {
                    projectFolderIds.push(match[1]);
                }
            }
        });
    }

    console.log('Project folder IDs to copy:', projectFolderIds);

    // 5) Copy each customer folder
    if (params.customersData) {
        for (const cust of params.customersData) {
            const link = cust.folderlinks || cust.folderlink;
            if (link) {
                const match = /\/folders\/([a-zA-Z0-9_-]+)/.exec(link);
                if (match) {
                    const custFolderId = match[1];
                    console.log(`Processing customer: ${cust.fullName} (${custFolderId})`);

                    // Create customer folder in date folder with fullName from payload
                    const { data: newCustFolder } = await drive.files.create({
                        resource: {
                            name: cust.fullName,  // Use fullName from payload instead of original folder name
                            mimeType: 'application/vnd.google-apps.folder',
                            parents: [dateFolderId]
                        },
                        fields: 'id'
                    });
                    console.log(`Created customer folder: ${cust.fullName}`);

                    // Copy only the project folders (by ID) from customer folder
                    if (projectFolderIds.length > 0) {
                        for (const projFolderId of projectFolderIds) {
                            try {
                                // Check if this project folder exists in this customer's folder
                                const { data: projMeta } = await drive.files.get({
                                    fileId: projFolderId,
                                    fields: 'name,parents'
                                });

                                // Check if this project folder is a child of the customer folder
                                if (projMeta.parents && projMeta.parents.includes(custFolderId)) {
                                    console.log(`  Copying project folder: ${projMeta.name}`);
                                    await copyFolderRecursively(drive, projFolderId, newCustFolder.id, null, 0);
                                }
                            } catch (err) {
                                // Project folder might not exist in this customer's folder, skip silently
                                console.log(`  Project folder ${projFolderId} not found in ${cust.fullName}'s folder`);
                            }
                        }
                    } else {
                        // No project folders specified, copy everything
                        console.log(`  No project folders specified, copying all subfolders`);
                        await copyFolderRecursively(drive, custFolderId, newCustFolder.id, null, 1);
                    }
                }
            }
        }
    }

    // Wait for any outstanding file copies to finish
    await copyLimiter(() => Promise.resolve());

    const sheetLink = `https://docs.google.com/spreadsheets/d/${newSheetId}/edit`;
    const folderLink = `https://drive.google.com/drive/folders/${dateFolderId}`;

    // 6) Update AppSheet
    const apiResult = await updateAppSheet(branchId, sheetLink, folderLink);

    // 7) Log the attempt
    await appendLog(sheets, branchId, sheetLink, folderLink, apiResult.statusCode, apiResult.responseText, '');

    console.log('Done:', sheetLink, folderLink);
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
