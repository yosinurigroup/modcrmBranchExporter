const MAX_CELL_LENGTH = 50;

// Requested Column Configurations
const CUSTOMER_COLUMNS = [
    "First Name", "Last Name", "Secondary Name", "Secondary Last Name", 
    "Address", "Unit #", "Phone", "Mobile", "Email", "Date of Birth", "Age", 
    "Secondary Age", "Senior Citizen", "Create By", 
    "TimeStamp", "Projects Price SubTotal", "Finance Total Approve", 
    "Total Loan", "Total Used", "Total Spent", "Total Cost", "Total Profit"
];

const PROJECT_COLUMNS = [
    "Project ID", "Customer Address", "Unit #", "Lead Source", 
    "Project Status", "Sales Rep", "Contract Sign Date", "HOA", "Project Type", 
    "Production Manager", "Project Manager", "Finance Manager", "Project Price", 
    "Project Balance", "Project Cost", "Total Used", "Finance Balance", "Anticipated", 
    "PTO Request", "PTO Submitted", "PTO Received", "PTO Status", "Has PTO", 
    "Closing Status", "Missing Documents", "In Production", "Job Status", 
    "Project Equipments", "Qty", "Vendor", "KW", "Watt", "Project Permit", 
    "Distance ft", "SSA", "Completion", "Final", "Create By", "TimeStamp", 
    "Payments Received", "Project Finance Balance", 
    "Money On The Table", "HOA Status"
];

const VENDOR_COLUMNS = [
    "Vendor Name", "Vendor Email", "Vendor Phone", 
    "Vendor Contact Person", "Vendor Address"
];

const VENDOR_INVOICE_COLUMNS = [
    "Vendor", "Project Address", "Project #", "Project Type", 
    "Project Equipments", "Invoice #", "Invoice Amount", 
    "Invoice Date", "Due Date", "Invoice Note", 
    "Create By", "TimeStamp"
];

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function truncate(text) {
    if (!text) return '';
    const str = String(text);
    if (str.length <= MAX_CELL_LENGTH) return str;
    return str.substring(0, MAX_CELL_LENGTH) + '...';
}

// Helper to map desired headers to source indices
function mapHeaders(desiredHeaders, sourceHeaderRow) {
    if (!sourceHeaderRow) return desiredHeaders.map(() => -1);
    
    return desiredHeaders.map(desired => {
        // Try exact match first
        let idx = sourceHeaderRow.findIndex(h => h && h.toLowerCase().trim() === desired.toLowerCase().trim());
        
        // Try fuzzy match if not found (contains)
        if (idx === -1) {
             const cleanDesired = desired.toLowerCase().replace(/[^a-z0-9]/g, '');
             idx = sourceHeaderRow.findIndex(h => {
                 if (!h) return false;
                 const cleanSource = h.toLowerCase().replace(/[^a-z0-9]/g, '');
                 return cleanSource === cleanDesired || cleanSource.includes(cleanDesired);
             });
        }
        return idx;
    });
}

// Utility to filter headers and row cells based on exclusion list
const getFilteredTable = (header, rows, excludeList = []) => {
    if (!header || !rows) return { header: [], rows: [] };
    const excludeSet = new Set(excludeList.map(h => h.toLowerCase()));
    
    // Identify indices to keep
    const indicesToKeep = [];
    const newHeader = [];
    header.forEach((h, i) => {
        const hClean = h ? h.toString().trim() : '';
        if (!excludeSet.has(hClean.toLowerCase())) {
            indicesToKeep.push(i);
            newHeader.push(hClean);
        }
    });

    const newRows = rows.map(r => indicesToKeep.map(i => r[i]));
    return { header: newHeader, rows: newRows };
};

function generateHtmlReport(data) {
    const { 
        customers, 
        projects, 
        missingDocs, 
        projectFinance,
        customerFinance,
        financeMissingDocs,
        projectPayments,
        projectsPermits,
        notes,
        courses,
        projectProduction, // New
        vendors,
        vendorInvoices,
        branchName 
    } = data;

    // Define exclusion lists for HTML VIEW (passed by user request)
    // PROJ PROD: We only want to KEEP specific columns. Using getFilteredTable logic requires exclusions?
    // User asked "with following columns only". 
    // It's easier to filter logically by "Keep List" as we did in filterData.
    // But since getFilteredTable uses exclusion, we'll implement a simple "Keep" helper or reuse getFilteredTable with a massive exclude list?
    // Simpler: PROJ_PROD_COLUMNS constant and use it for filtering.
    // The previous tables used "exclude".
    
    const exclude = {
        cf: ["customerFinanceID", "Customer ID", "ProjectID", "Branch"],
        pf: ["projectFinanceID", "customerFinanceID"],
        pp: ["customerFinanceID", "Record ID", "Customer"],
        pp: ["customerFinanceID", "Record ID", "Customer"],
        prod: [], // We will filter PROD by "Keep" logic manually
        vendorInvoices: [] // Show all specified columns
    };
    
    const PROJ_PROD_DISPLAY = [
        "Job Status", "Vendor", "Equipment Name", "Brand", 
        "Qty", "Watt", "KW", "Permit", 
        "Distance (ft)", "SSA", "Completion", "Final"
    ];

    // 1. Map Columns
    const custIndices = mapHeaders(CUSTOMER_COLUMNS, customers.header);
    const projIndices = mapHeaders(PROJECT_COLUMNS, projects.header);
    
    // Key Indices for Linking
    const cIdIdx = mapHeaders(["Customer ID"], customers.header)[0];
    const pIdIdx = mapHeaders(["Project ID"], projects.header)[0];
    const pCIdIdx = mapHeaders(["Customer ID"], projects.header)[0];
    
    // 2. Build Hierarchy
    const customerMap = {};

    customers.rows.forEach(row => {
        const id = cIdIdx >= 0 ? row[cIdIdx] : 'N/A';
        customerMap[id] = {
            id: id,
            row: row,
            projects: [],
            customerFinance: []
        };
    });

    // Link Customer Finance (Col B=index 1 is Customer ID)
        if (customerFinance.rows) {
            customerFinance.rows.forEach(row => {
               const cid = row[1];
               if (customerMap[cid]) {
                   // Store RAW row for logic, filtering happens at render time
                   const finRecord = { row: row, missingDocs: [] };
                   const cfId = row[0];
                   if (financeMissingDocs.rows) {
                       financeMissingDocs.rows.forEach(fmdRow => {
                           if (fmdRow[2] === cfId) finRecord.missingDocs.push(fmdRow);
                       });
                   }
                   customerMap[cid].customerFinance.push(finRecord);
               }
            });
        }

    // Projects
    projects.rows.forEach(row => {
        const cId = pCIdIdx >= 0 ? row[pCIdIdx] : null;
        const pId = pIdIdx >= 0 ? row[pIdIdx] : null;
        
        if (cId && customerMap[cId]) {
            customerMap[cId].projects.push({
                id: pId,
                row: row,
                missingDocs: [],
                projectFinance: [],
                projectPayments: [],
                projectsPermits: [],
                projectProduction: [],
                notes: []
            });
        }
    });

    // Link Project Details
    const mdPIdIdx = 1; // From index.js
    const pfPIdIdx = 2; // From index.js
    const ppPIdIdx = 3; // From index.js
    const permitsPIdIdx = 1; // From index.js
    
    // Notes: Dynamic lookup because columns shift
    let notesPIdIdx = -1;
    if (notes.header) {
        notesPIdIdx = notes.header.findIndex(h => {
             const clean = h ? h.toString().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
             return clean === 'projectid' || clean === 'project_id' || clean === 'project id';
        });
    }

    // Production: Search for Project ID column
    const prodPIdIdx = projectProduction.header ? projectProduction.header.findIndex(h => h && (h.toLowerCase().includes('project id') || h.toLowerCase() === 'pid')) : -1;

    // Helper to link data to projects
    const linkDataToProject = (rows, pidIndex, targetArrayName) => {
        if (!rows || pidIndex === -1) return;
        rows.forEach(row => {
            const pId = row[pidIndex];
            if (pId && customerMap) {
                // Find connection - brute force or optimized
                // Since we don't have a direct ProjectID -> Project Object hash map available here (it's nested),
                // we iterate customers. (Optimizable, but data size is small per branch)
                Object.values(customerMap).forEach(c => {
                    const match = c.projects.find(p => p.id === pId);
                    if (match) {
                        match[targetArrayName].push(row);
                    }
                });
            }
        });
    };

    linkDataToProject(missingDocs.rows, mdPIdIdx, 'missingDocs');
    linkDataToProject(projectFinance.rows, pfPIdIdx, 'projectFinance');
    linkDataToProject(projectPayments.rows, ppPIdIdx, 'projectPayments');
    linkDataToProject(projectsPermits.rows, permitsPIdIdx, 'projectsPermits');
    linkDataToProject(notes.rows, notesPIdIdx, 'notes');
    linkDataToProject(projectProduction.rows, prodPIdIdx, 'projectProduction');


    linkDataToProject(notes.rows, notesPIdIdx, 'notes');
    linkDataToProject(projectProduction.rows, prodPIdIdx, 'projectProduction');


    // --- 3. BUILD VENDOR HIERARCHY ---
    const vendorIndices = mapHeaders(VENDOR_COLUMNS, vendors ? vendors.header : []);
    const vendorInvoiceIndices = mapHeaders(VENDOR_INVOICE_COLUMNS, vendorInvoices ? vendorInvoices.header : []);
    
    // Determine Vendor ID Index in Source
    const vIdIdx = vendors ? mapHeaders(["Row ID"], vendors.header)[0] : -1;
    // Determine Vendor Match Column in Invoices (Column B -> index 1)
    // Actually typically we look up by name or ID. User said: 
    // "Vendor Invoices column Vendor in column B" MATCHES "Row ID column A" of Vendors.
    // Let's assume typical index 1 for "Vendor" in Invoices (Col B).
    const viVendorIdx = 1; 

    // Build Vendor Map
    const vendorMap = {};
    if (vendors && vendors.rows) {
        vendors.rows.forEach(row => {
            const vid = vIdIdx !== -1 ? row[vIdIdx] : null;
            if (vid) {
                vendorMap[vid] = {
                    id: vid,
                    row: row,
                    invoices: []
                };
            }
        });
    }

    // Link Invoices to Vendors
    if (vendorInvoices && vendorInvoices.rows) {
        vendorInvoices.rows.forEach(row => {
            const vid = row[viVendorIdx]; // Link by Vendor ID
            if (vid && vendorMap[vid]) {
                vendorMap[vid].invoices.push(row);
            }
        });
    }


    // 4. Generate HTML
    const dateStr = new Date().toLocaleString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(branchName)}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: sans-serif; }
        .rotate-icon { transform: rotate(90deg); }
        tr.expanded > td > div > svg { transform: rotate(90deg); }
    </style>
    <script>
        function toggleRow(id) {
            const el = document.getElementById(id);
            const icon = document.getElementById('icon-' + id);
            if (el.classList.contains('hidden')) {
                el.classList.remove('hidden');
                if(icon) icon.classList.add('rotate-90');
            } else {
                el.classList.add('hidden');
                if(icon) icon.classList.remove('rotate-90');
            }
        }

        function openTab(tabName) {
            const tabs = ['tab-customers', 'tab-vendors'];
            const btns = ['btn-customers', 'btn-vendors'];
            
            tabs.forEach(t => {
                document.getElementById(t).classList.add('hidden');
            });
            btns.forEach(b => {
                document.getElementById(b).classList.remove('bg-blue-600', 'text-white');
                document.getElementById(b).classList.add('bg-gray-200', 'text-gray-700');
            });

            document.getElementById('tab-' + tabName).classList.remove('hidden');
            document.getElementById('btn-' + tabName).classList.add('bg-blue-600', 'text-white');
            document.getElementById('btn-' + tabName).classList.remove('bg-gray-200', 'text-gray-700');
        }
    </script>
</head>
<body class="bg-gray-50 text-gray-800 p-4">

    <!-- Header -->
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">${escapeHtml(branchName)}</h1>
        <p class="text-xs text-gray-500 mt-1">Generated: ${dateStr}</p>
    </div>

    <!-- TABS NAVIGATION -->
    <div class="mb-4 flex space-x-2">
        <button id="btn-customers" onclick="openTab('customers')" class="px-4 py-2 rounded-md font-medium text-sm bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus:outline-none">
            Customers
        </button>
        <button id="btn-vendors" onclick="openTab('vendors')" class="px-4 py-2 rounded-md font-medium text-sm bg-gray-200 text-gray-700 shadow-sm hover:bg-gray-300 focus:outline-none">
            Vendors
        </button>
    </div>

    <!-- MAIN CUSTOMER TABLE (Wrapped in Tab Div) -->
    <div id="tab-customers">
    <div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg bg-white">
        <table class="min-w-full divide-y divide-gray-300">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="w-8 px-2 py-2"></th> <!-- Expander -->
                    ${CUSTOMER_COLUMNS.map(col => {
                        const isAddress = col.toLowerCase() === 'address';
                        const widthClass = isAddress ? 'min-w-[200px]' : '';
                        return `
                        <th scope="col" class="px-2 py-2 text-left text-[10px] font-semibold text-gray-900 capitalize border-r border-gray-200 last:border-0 align-bottom ${widthClass}">
                            ${col}
                        </th>
                        `;
                    }).join('')}
                </tr>
            </thead>
            <tbody class="divide-y divide-gray-200 bg-white">
                ${Object.values(customerMap).map((cust, cIdx) => {
                    const custRowId = `cust-${cIdx}`;
                    return `
                    <!-- CUSTOMER ROW -->
                    <tr class="hover:bg-blue-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-blue-500" onclick="toggleRow('${custRowId}')">
                        <td class="px-2 py-1 text-center">
                            <svg id="icon-${custRowId}" class="h-4 w-4 text-gray-400 transition-transform transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </td>
                        ${custIndices.map((idx, i) => {
                            const colName = CUSTOMER_COLUMNS[i];
                            const isAddress = colName && colName.toLowerCase() === 'address';
                            const widthClass = isAddress ? 'min-w-[200px]' : '';
                            return `
                            <td class="px-2 py-1 text-xs text-gray-700 border-r border-gray-100 last:border-0 whitespace-normal break-words ${widthClass}">
                                ${idx !== -1 ? escapeHtml(cust.row[idx]) : ''}
                            </td>
                            `;
                        }).join('')}
                    </tr>

                    <!-- NESTED PROJECTS (Hidden by default) -->
                    <tr id="${custRowId}" class="hidden bg-gray-50">
                        <td colspan="${CUSTOMER_COLUMNS.length + 1}" class="px-4 py-4 inset-shadow">
                            
                            <!-- CUSTOMER FINANCE SECTION -->
                            <!-- CUSTOMER FINANCE SECTION -->
                            ${cust.customerFinance.length > 0 ? (() => {
                                // Filter Header once
                                const filteredHeader = getFilteredTable(customerFinance.header, [], exclude.cf).header;
                                return `
                                <div class="ml-4 pl-4 border-l-2 border-green-200 mb-6">
                                    <h3 class="text-sm font-bold text-green-800 mb-2 uppercase tracking-wide">Customer Finance</h3>
                                    <div class="overflow-x-auto border rounded-md border-green-100 bg-white shadow-sm">
                                        <table class="min-w-full divide-y divide-green-100">
                                            <thead class="bg-green-50">
                                                <tr>${filteredHeader.map(h => `<th class="px-2 py-1 text-left text-[10px] font-bold text-green-700 capitalize align-bottom">${h}</th>`).join('')}</tr>
                                            </thead>
                                            <tbody class="divide-y divide-green-50">
                                                ${cust.customerFinance.map(cf => {
                                                    // Filter Row
                                                    const filteredRow = getFilteredTable(customerFinance.header, [cf.row], exclude.cf).rows[0];
                                                    return `
                                                    <tr>${filteredRow.map(c => `<td class="px-2 py-1 text-[11px] text-gray-600 whitespace-normal break-words">${escapeHtml(c)}</td>`).join('')}</tr>
                                                    ${cf.missingDocs.length > 0 ? `
                                                    <tr><td colspan="${filteredHeader.length}" class="bg-red-50/30 px-4 py-2">
                                                        <div class="text-[10px] font-bold text-red-700 mb-1">Finance Missing Documents:</div>
                                                        <table class="w-full border border-red-100">
                                                            <thead class="bg-red-50"><tr>${financeMissingDocs.header.map(h=>`<th class="px-1 py-0.5 text-[9px] text-red-600 text-left capitalize align-bottom">${h}</th>`).join('')}</tr></thead>
                                                            <tbody>${cf.missingDocs.map(r=>`<tr>${r.map(c=>`<td class="px-1 py-0.5 text-[9px] text-gray-500 whitespace-normal break-words">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                                                        </table>
                                                    </td></tr>` : '' }
                                                    `;
                                                }).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                `;
                            })() : ''}

                            <div class="ml-4 pl-4 border-l-2 border-blue-200">
                                <h3 class="text-sm font-bold text-blue-800 mb-2 uppercase tracking-wide">Projects (${cust.projects.length})</h3>
                                
                                ${cust.projects.length === 0 ? '<p class="text-xs text-gray-500 italic">No projects found.</p>' : `
                                
                                <div class="overflow-x-auto border rounded-md border-blue-100 bg-white shadow-sm">
                                    <table class="min-w-full divide-y divide-blue-100">
                                        <thead class="bg-blue-50">
                                            <tr>
                                                <th class="w-6 px-2 py-1"></th>
                                                ${PROJECT_COLUMNS.map(col => {
                                                    const isAddress = col.toLowerCase() === 'customer address';
                                                    const widthClass = isAddress ? 'min-w-[200px]' : '';
                                                    return `
                                                    <th class="px-2 py-1 text-left text-[10px] font-bold text-blue-700 capitalize border-r border-blue-100 align-bottom ${widthClass}">
                                                        ${col}
                                                    </th>
                                                    `;
                                                }).join('')}
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-blue-50">
                                            ${cust.projects.map((proj, pIdx) => {
                                                const projRowId = `proj-${cIdx}-${pIdx}`;
                                                return `
                                                <tr class="hover:bg-blue-50/50 cursor-pointer text-[11px]" onclick="toggleRow('${projRowId}')">
                                                    <td class="px-2 py-1 text-center">
                                                        <svg id="icon-${projRowId}" class="h-3 w-3 text-blue-400 transition-transform transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </td>
                                                    ${projIndices.map((idx, i) => {
                                                        const colName = PROJECT_COLUMNS[i];
                                                        const isAddress = colName && colName.toLowerCase() === 'customer address';
                                                        const widthClass = isAddress ? 'min-w-[200px]' : '';
                                                        return `
                                                        <td class="px-2 py-1 text-gray-600 border-r border-blue-50 last:border-0 whitespace-normal break-words ${widthClass}">
                                                            ${idx !== -1 ? escapeHtml(proj.row[idx]) : ''}
                                                        </td>
                                                        `;
                                                    }).join('')}
                                                </tr>
                                                
                                                <!-- DETAILS: FINANCE & DOCS (Hidden) -->
                                                <tr id="${projRowId}" class="hidden bg-white">
                                                    <td colspan="${PROJECT_COLUMNS.length + 1}" class="px-4 py-3">
                                                        <div class="flex flex-col gap-4">
                                                        
                                                            <!-- MISSING DOCS -->
                                                            <div class="border rounded border-red-100">
                                                                <div class="bg-red-50 px-2 py-1 text-xs font-bold text-red-700 uppercase border-b border-red-100">
                                                                    Missing Documents ${proj.missingDocs.length ? `(${proj.missingDocs.length})` : ''}
                                                                </div>
                                                                ${proj.missingDocs.length === 0 ? 
                                                                    '<div class="p-2 text-xs text-green-600 flex items-center gap-1">✔ All good</div>' : 
                                                                    `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-red-50">
                                                                        <thead class="bg-white"><tr>${missingDocs.header.map(h=>`<th class="px-2 py-1 text-[10px] text-left text-gray-500 capitalize align-bottom">${h}</th>`).join('')}</tr></thead>
                                                                        <tbody class="divide-y divide-red-50">${proj.missingDocs.map(r=>`<tr>${r.map(c=>`<td class="px-2 py-1 text-[10px] text-gray-600 whitespace-normal break-words">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                                                                    </table></div>`
                                                                }
                                                            </div>

                                                            <!-- PROJECT FINANCE -->
                                                            <div class="border rounded border-indigo-100">
                                                                <div class="bg-indigo-50 px-2 py-1 text-xs font-bold text-indigo-700 uppercase border-b border-indigo-100">
                                                                    Project Finance ${proj.projectFinance.length ? `(${proj.projectFinance.length})` : ''}
                                                                </div>
                                                                ${proj.projectFinance.length === 0 ? 
                                                                    '<div class="p-2 text-xs text-gray-400">No finance records</div>' : 
                                                                    (() => {
                                                                        const filteredPF = getFilteredTable(projectFinance.header, proj.projectFinance, exclude.pf);
                                                                        return `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-indigo-50">
                                                                            <thead class="bg-white"><tr>${filteredPF.header.map(h=>`<th class="px-2 py-1 text-[10px] text-left text-gray-500 capitalize align-bottom">${h}</th>`).join('')}</tr></thead>
                                                                            <tbody class="divide-y divide-indigo-50">${filteredPF.rows.map(r=>`<tr>${r.map(c=>`<td class="px-2 py-1 text-[10px] text-gray-600 whitespace-normal break-words">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                                                                         </table></div>`;
                                                                    })()
                                                                }
                                                            </div>

                                                            <!-- PROJECT PAYMENTS -->
                                                            <div class="border rounded border-emerald-100">
                                                                <div class="bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 uppercase border-b border-emerald-100">
                                                                    Project Payments ${proj.projectPayments.length ? `(${proj.projectPayments.length})` : ''}
                                                                </div>
                                                                ${proj.projectPayments.length > 0 ? 
                                                                    (() => {
                                                                        const filteredPP = getFilteredTable(projectPayments.header, proj.projectPayments, exclude.pp);
                                                                        return `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-emerald-50">
                                                                            <thead class="bg-white"><tr>${filteredPP.header.map(h=>`<th class="px-2 py-1 text-[10px] text-left text-gray-500 capitalize align-bottom">${h}</th>`).join('')}</tr></thead>
                                                                            <tbody class="divide-y divide-emerald-50">${filteredPP.rows.map(r=>`<tr>${r.map(c=>`<td class="px-2 py-1 text-[10px] text-gray-600 whitespace-normal break-words">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                                                                        </table></div>`;
                                                                    })() : '<div class="p-2 text-xs text-gray-400">No payments</div>'
                                                                }
                                                            </div>

                                                            <!-- PERMITS -->
                                                            <div class="border rounded border-yellow-100">
                                                                <div class="bg-yellow-50 px-2 py-1 text-xs font-bold text-yellow-700 uppercase border-b border-yellow-100">
                                                                    Permits ${proj.projectsPermits.length ? `(${proj.projectsPermits.length})` : ''}
                                                                </div>
                                                                ${proj.projectsPermits.length > 0 ? 
                                                                    (() => {
                                                                        const filteredPermits = getFilteredTable(projectsPermits.header, proj.projectsPermits, []);
                                                                        return `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-yellow-50">
                                                                            <thead class="bg-white"><tr>${filteredPermits.header.map(h=>`<th class="px-2 py-1 text-[10px] text-left text-gray-500 capitalize align-bottom">${h}</th>`).join('')}</tr></thead>
                                                                            <tbody class="divide-y divide-yellow-50">${filteredPermits.rows.map(r=>`<tr>${r.map(c=>`<td class="px-2 py-1 text-[10px] text-gray-600 whitespace-normal break-words">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                                                                        </table></div>`;
                                                                    })() : '<div class="p-2 text-xs text-gray-400">No permits found</div>'
                                                                }
                                                            </div>

                                                             <!-- PROJECT PRODUCTION -->
                                                             <div class="border rounded border-orange-100">
                                                                 <div class="bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700 uppercase border-b border-orange-100">
                                                                     Production ${proj.projectProduction.length ? `(${proj.projectProduction.length})` : ''}
                                                                 </div>
                                                                 ${proj.projectProduction.length > 0 ? 
                                                                     (() => {
                                                                         const getIncludedTable = (header, rows, includeList) => {
                                                                            const indices = [];
                                                                            const newHeader = [];
                                                                            includeList.forEach(col => {
                                                                                const idx = header.findIndex(h => h && h.toLowerCase().trim() === col.toLowerCase().trim());
                                                                                if (idx !== -1) {
                                                                                    indices.push(idx);
                                                                                    newHeader.push(header[idx]);
                                                                                }
                                                                            });
                                                                            const newRows = rows.map(r => indices.map(i => r[i]));
                                                                            return { header: newHeader, rows: newRows };
                                                                         };

                                                                         const filteredProd = getIncludedTable(projectProduction.header, proj.projectProduction, PROJ_PROD_DISPLAY);
                                                                         
                                                                         return `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-orange-50">
                                                                             <thead class="bg-white"><tr>${filteredProd.header.map(h=>`<th class="px-2 py-1 text-[10px] text-left text-gray-500 capitalize align-bottom">${h}</th>`).join('')}</tr></thead>
                                                                             <tbody class="divide-y divide-orange-50">${filteredProd.rows.map(r=>`<tr>${r.map(c=>`<td class="px-2 py-1 text-[10px] text-gray-600 whitespace-normal break-words">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                                                                         </table></div>`;
                                                                     })() : '<div class="p-2 text-xs text-gray-400">No production records</div>'
                                                                 }
                                                             </div>

                                                            <!-- NOTES -->
                                                            <div class="border rounded border-yellow-100">
                                                                <div class="bg-yellow-50 px-2 py-1 text-xs font-bold text-yellow-700 uppercase border-b border-yellow-100">
                                                                    Notes ${proj.notes.length ? `(${proj.notes.length})` : ''}
                                                                </div>
                                                                ${proj.notes.length > 0 ? 
                                                                    `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-yellow-50">
                                                                        <thead class="bg-white">
                                                                            <tr>${notes.header.map((h, i) => {
                                                                                // Skip rendering ProjectId column in HTML View as requested per "remove in html"
                                                                                if (i === notesPIdIdx) return '';
                                                                                return `<th class="px-2 py-1 text-[10px] text-left text-gray-500 capitalize align-bottom">${h}</th>`;
                                                                            }).join('')}</tr>
                                                                        </thead>
                                                                        <tbody class="divide-y divide-yellow-50">
                                                                            ${proj.notes.map(r => `<tr>${r.map((c, i) => {
                                                                                if (i === notesPIdIdx) return '';
                                                                                // Modified styling: min-w for compactness but whitespace-normal for wrapping
                                                                                return `<td class="px-2 py-1 text-[10px] text-gray-600 whitespace-normal break-words">${escapeHtml(c)}</td>`;
                                                                            }).join('')}</tr>`).join('')}
                                                                        </tbody>
                                                                    </table></div>` : '<div class="p-2 text-xs text-gray-400">No notes</div>'
                                                                }
                                                            </div>
                                                            
                                                        </div>
                                                    </td>
                                                </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
                                        <tfoot class="bg-blue-50">
                                            <tr>
                                                <td colspan="${PROJECT_COLUMNS.length + 1}" class="px-4 py-2 text-xs text-blue-600 font-semibold text-right">
                                                    Total Projects: ${cust.projects.length}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                                `} <!-- End Projects Table Loop -->
                            </div>
                        </td>
                    </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    </div>
    </div> <!-- END CUSTOMERS TAB -->

    <!-- VENDORS TAB -->
    <div id="tab-vendors" class="hidden">
        <div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg bg-white">
            <table class="min-w-full divide-y divide-gray-300">
                <thead class="bg-gray-50">
                    <tr>
                        <th scope="col" class="w-8 px-2 py-2"></th>
                        ${VENDOR_COLUMNS.map(col => `
                             <th scope="col" class="px-2 py-2 text-left text-[10px] font-semibold text-gray-900 capitalize border-r border-gray-200 last:border-0 align-bottom">
                                ${col}
                            </th>
                        `).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${Object.values(vendorMap).map((vend, vIdx) => {
                        const vendRowId = `vend-${vIdx}`;
                        return `
                        <!-- VENDOR ROW -->
                        <tr class="hover:bg-purple-50 cursor-pointer transition-colors border-l-4 border-transparent hover:border-purple-500" onclick="toggleRow('${vendRowId}')">
                             <td class="px-2 py-1 text-center">
                                <svg id="icon-${vendRowId}" class="h-4 w-4 text-gray-400 transition-transform transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </td>
                            ${vendorIndices.map(idx => `
                                <td class="px-2 py-1 text-xs text-gray-700 border-r border-gray-100 last:border-0 whitespace-normal break-words">
                                    ${idx !== -1 ? escapeHtml(vend.row[idx]) : ''}
                                </td>
                            `).join('')}
                        </tr>

                        <!-- VENDOR INVOICES (Nested) -->
                        <tr id="${vendRowId}" class="hidden bg-gray-50">
                            <td colspan="${VENDOR_COLUMNS.length + 1}" class="px-4 py-4 inset-shadow">
                                <div class="ml-4 pl-4 border-l-2 border-purple-200">
                                    <h3 class="text-sm font-bold text-purple-800 mb-2 uppercase tracking-wide">Vendor Invoices (${vend.invoices.length})</h3>
                                    ${vend.invoices.length === 0 ? '<p class="text-xs text-gray-500 italic">No invoices found.</p>' : `
                                        <div class="overflow-x-auto border rounded-md border-purple-100 bg-white shadow-sm">
                                            <table class="min-w-full divide-y divide-purple-100">
                                                <thead class="bg-purple-50">
                                                    <tr>
                                                        ${vendorInvoiceIndices.map((origIdx, i) => `
                                                            <th class="px-2 py-1 text-left text-[10px] font-bold text-purple-700 capitalize border-r border-purple-100 align-bottom">
                                                                ${VENDOR_INVOICE_COLUMNS[i]}
                                                            </th>
                                                        `).join('')}
                                                    </tr>
                                                </thead>
                                                <tbody class="divide-y divide-purple-50">
                                                    ${vend.invoices.map(invRow => `
                                                        <tr class="hover:bg-purple-50/50">
                                                            ${vendorInvoiceIndices.map(idx => `
                                                                <td class="px-2 py-1 text-[11px] text-gray-600 border-r border-purple-50 last:border-0 whitespace-normal break-words">
                                                                    ${idx !== -1 ? escapeHtml(invRow[idx]) : ''}
                                                                </td>
                                                            `).join('')}
                                                        </tr>
                                                    `).join('')}
                                                </tbody>
                                            </table>
                                        </div>
                                    `}
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>

</body>
</html>`;
}

module.exports = { generateHtmlReport };
