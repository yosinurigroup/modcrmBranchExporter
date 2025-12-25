const MAX_CELL_LENGTH = 50;

// Requested Column Configurations
const CUSTOMER_COLUMNS = [
    "Customer ID", "First Name", "Last Name", "Secondary Name", "Secondary Last Name", 
    "Address", "Unit #", "Phone", "Mobile", "Email", "Date of Birth", "Age", 
    "Secondary Age", "Senior Citizen", "Customer Files", "Update", "Create By", 
    "TimeStamp", "Folder Id", "Projects Price SubTotal", "Finance Total Approve", 
    "Total Loan", "Total Used", "Total Spent", "Total Cost", "Total Profit", 
    "Last Edit By", "Last Edit On", "Favorit", "Projects Missing Finance Balance", 
    "Projects Payment Balance", "Money On The Table", "Projects Balance"
];

const PROJECT_COLUMNS = [
    "Project ID", "Customer Address", "Unit #", "Project Folder", "Lead Source", 
    "Project Status", "Sales Rep", "Contract Sign Date", "HOA", "Project Type", 
    "Production Manager", "Project Manager", "Finance Manager", "Project Price", 
    "Project Balance", "Project Cost", "Total Used", "Finance Balance", "Anticipated", 
    "PTO Request", "PTO Submitted", "PTO Received", "PTO Status", "Has PTO", 
    "Closing Status", "Missing Documents", "In Production", "Job Status", 
    "Project Equipments", "Qty", "Vendor", "KW", "Watt", "Project Permit", 
    "Distance ft", "SSA", "Completion", "Final", "Create By", "TimeStamp", 
    "Last Edit By", "Last Edit On", "Payments Received", "Project Finance Balance", 
    "Money On The Table", "HOA Status"
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

function generateHtmlReport(data) {
    const { 
        customers, 
        projects, 
        missingDocs, 
        projectFinance,
        branchName 
    } = data;

    // 1. Map Columns
    const custIndices = mapHeaders(CUSTOMER_COLUMNS, customers.header);
    const projIndices = mapHeaders(PROJECT_COLUMNS, projects.header);
    
    // Key Indices for Linking
    const cIdIdx = mapHeaders(["Customer ID"], customers.header)[0];
    const pIdIdx = mapHeaders(["Project ID"], projects.header)[0];
    const pCIdIdx = mapHeaders(["Customer ID"], projects.header)[0];
    
    // Fallback indices for linkage if named differently in source
    // (We rely on logic from index.js mostly, but here we need to link the rows for the view)
    // Actually index.js passes filtered raw rows. We need to trust the ID columns exist.
    
    // 2. Build Hierarchy
    const customerMap = {};

    customers.rows.forEach(row => {
        const id = cIdIdx >= 0 ? row[cIdIdx] : 'N/A';
        customerMap[id] = {
            id: id,
            row: row,
            projects: []
        };
    });

    projects.rows.forEach(row => {
        const cId = pCIdIdx >= 0 ? row[pCIdIdx] : null;
        const pId = pIdIdx >= 0 ? row[pIdIdx] : null;
        
        if (cId && customerMap[cId]) {
            customerMap[cId].projects.push({
                id: pId,
                row: row,
                missingDocs: [],
                projectFinance: []
            });
        }
    });

    // Link Details (Optimized lookup could be done here, but simple loops for now)
    // Missing Docs (Col 1 is PID in index.js assumption, let's try to map it)
    const mdPIdIdx = 1; // From index.js
    missingDocs.rows.forEach(row => {
        const pId = row[mdPIdIdx];
        for (const c in customerMap) {
            const proj = customerMap[c].projects.find(p => p.id === pId);
            if (proj) { proj.missingDocs.push(row); break; }
        }
    });

    // Project Finance (Col 2 is PID in index.js assumption)
    const pfPIdIdx = 2; // From index.js
    projectFinance.rows.forEach(row => {
        const pId = row[pfPIdIdx];
        for (const c in customerMap) {
            const proj = customerMap[c].projects.find(p => p.id === pId);
            if (proj) { proj.projectFinance.push(row); break; }
        }
    });

    // 3. Generate HTML
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
    </script>
</head>
<body class="bg-gray-50 text-gray-800 p-4">

    <!-- Header -->
    <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900">${escapeHtml(branchName)}</h1>
        <p class="text-xs text-gray-500 mt-1">Generated: ${dateStr}</p>
    </div>

    <!-- MAIN CUSTOMER TABLE -->
    <div class="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg bg-white">
        <table class="min-w-full divide-y divide-gray-300">
            <thead class="bg-gray-50">
                <tr>
                    <th scope="col" class="w-8 px-2 py-2"></th> <!-- Expander -->
                    ${CUSTOMER_COLUMNS.map(col => `
                        <th scope="col" class="px-2 py-2 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider whitespace-nowrap border-r border-gray-200 last:border-0">
                            ${col}
                        </th>
                    `).join('')}
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
                        ${custIndices.map(idx => `
                            <td class="px-2 py-1 text-xs text-gray-700 whitespace-nowrap border-r border-gray-100 last:border-0">
                                ${idx !== -1 ? escapeHtml(truncate(cust.row[idx])) : ''}
                            </td>
                        `).join('')}
                    </tr>

                    <!-- NESTED PROJECTS (Hidden by default) -->
                    <tr id="${custRowId}" class="hidden bg-gray-50">
                        <td colspan="${CUSTOMER_COLUMNS.length + 1}" class="px-4 py-4 inset-shadow">
                            <div class="ml-4 pl-4 border-l-2 border-blue-200">
                                <h3 class="text-sm font-bold text-blue-800 mb-2 uppercase tracking-wide">Projects (${cust.projects.length})</h3>
                                
                                ${cust.projects.length === 0 ? '<p class="text-xs text-gray-500 italic">No projects found.</p>' : `
                                
                                <div class="overflow-x-auto border rounded-md border-blue-100 bg-white shadow-sm">
                                    <table class="min-w-full divide-y divide-blue-100">
                                        <thead class="bg-blue-50">
                                            <tr>
                                                <th class="w-6 px-2 py-1"></th>
                                                ${PROJECT_COLUMNS.map(col => `
                                                    <th class="px-2 py-1 text-left text-[10px] font-bold text-blue-700 uppercase tracking-wider whitespace-nowrap border-r border-blue-100">
                                                        ${col}
                                                    </th>
                                                `).join('')}
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
                                                    ${projIndices.map(idx => `
                                                        <td class="px-2 py-1 text-gray-600 whitespace-nowrap border-r border-blue-50 last:border-0">
                                                            ${idx !== -1 ? escapeHtml(truncate(proj.row[idx])) : ''}
                                                        </td>
                                                    `).join('')}
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
                                                                        <thead class="bg-white"><tr>${missingDocs.header.map(h=>`<th class="px-2 py-1 text-[10px] text-left text-gray-500">${h}</th>`).join('')}</tr></thead>
                                                                        <tbody class="divide-y divide-red-50">${proj.missingDocs.map(r=>`<tr>${r.map(c=>`<td class="px-2 py-1 text-[10px] text-gray-600 truncate max-w-[100px]">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
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
                                                                    `<div class="overflow-x-auto"><table class="min-w-full divide-y divide-indigo-50">
                                                                        <thead class="bg-white"><tr>${projectFinance.header.map(h=>`<th class="px-2 py-1 text-[10px] text-left text-gray-500">${h}</th>`).join('')}</tr></thead>
                                                                        <tbody class="divide-y divide-indigo-50">${proj.projectFinance.map(r=>`<tr>${r.map(c=>`<td class="px-2 py-1 text-[10px] text-gray-600 truncate max-w-[100px]">${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody>
                                                                     </table></div>`
                                                                }
                                                            </div>
                                                            
                                                        </div>
                                                    </td>
                                                </tr>
                                                `;
                                            }).join('')}
                                        </tbody>
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

</body>
</html>`;
}

module.exports = { generateHtmlReport };
