const MAX_CELL_LENGTH = 100;

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

function findIndex(header, keywords) {
    if (!header) return -1;
    return header.findIndex(h => h && keywords.some(k => h.toLowerCase().includes(k)));
}

function generateHtmlReport(data) {
    const { 
        customers, // { header, rows }
        projects, 
        missingDocs, 
        projectFinance,
        branchName 
    } = data;

    // 1. Identify Key Columns
    // Customer Columns
    const cIdIdx = findIndex(customers.header, ['customer id', 'cid', 'id']);
    const cNameIdx = findIndex(customers.header, ['full name', 'name', 'customer']);
    
    // Project Columns
    const pIdIdx = findIndex(projects.header, ['project id', 'pid', 'id']);
    const pCIdIdx = findIndex(projects.header, ['customer id', 'cid']);
    const pNameIdx = findIndex(projects.header, ['project name', 'name']);
    
    // Missing Docs Columns
    // Assuming col 1 is PID as per index.js logic, but let's try to find it dynamically if possible, else fallback
    // In index.js we used row[1] for Missing Docs Project ID
    const mdPIdIdx = 1; 

    // Project Finance Columns
    // In index.js we used row[2] for Project Finance Project ID
    const pfPIdIdx = 2;

    // 2. Build Data Hierarchy
    // Map: CustomerID -> { info: row, projects: [ { info: row, missing: [], finance: [] } ] }
    const customerMap = {};

    // Process Customers
    customers.rows.forEach(row => {
        const id = row[cIdIdx];
        if (id) {
            customerMap[id] = {
                id: id,
                name: cNameIdx >= 0 ? row[cNameIdx] : 'Unknown',
                row: row,
                projects: []
            };
        }
    });

    // Process Projects
    projects.rows.forEach(row => {
        const cId = row[pCIdIdx];
        const pId = row[pIdIdx];
        
        if (cId && customerMap[cId]) {
            customerMap[cId].projects.push({
                id: pId,
                name: pNameIdx >= 0 ? row[pNameIdx] : 'Project',
                row: row,
                missingDocs: [],
                projectFinance: []
            });
        }
    });

    // Process Missing Docs
    if (missingDocs.rows && missingDocs.rows.length) {
        missingDocs.rows.forEach(row => {
            const pId = row[mdPIdIdx];
            // Find project
            // This is slow O(N*M), but N is small (50 filtered per run usually). Optimization: Make a Project Map.
            // Let's do a quick project map
            for (const cId in customerMap) {
                const proj = customerMap[cId].projects.find(p => p.id === pId);
                if (proj) {
                    proj.missingDocs.push(row);
                    break;
                }
            }
        });
    }

    // Process Project Finance
    if (projectFinance.rows && projectFinance.rows.length) {
        projectFinance.rows.forEach(row => {
            const pId = row[pfPIdIdx];
            for (const cId in customerMap) {
                const proj = customerMap[cId].projects.find(p => p.id === pId);
                if (proj) {
                    proj.projectFinance.push(row);
                    break;
                }
            }
        });
    }

    // 3. Generate HTML
    const dateStr = new Date().toLocaleString();
    
    // Header Section
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Export Report - ${escapeHtml(branchName)}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap');
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-50 text-slate-800 p-6 min-h-screen">
    <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <header class="mb-10 text-center">
            <h1 class="text-4xl font-bold text-slate-900 mb-2">Branch Export Report</h1>
            <p class="text-xl text-slate-600">${escapeHtml(branchName)}</p>
            <p class="text-sm text-slate-500 mt-2">Generated on ${dateStr}</p>
        </header>
        
        <div class="space-y-8">
    `;

    // Loop through Customers
    Object.values(customerMap).forEach(cust => {
        html += `
            <!-- Customer Card -->
            <div class="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden transform transition hover:shadow-xl">
                <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold flex items-center gap-2">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                            ${escapeHtml(cust.name)}
                        </h2>
                        <p class="text-blue-100 text-sm mt-1">ID: ${escapeHtml(cust.id)}</p>
                    </div>
                    <div class="text-right">
                        <span class="bg-blue-500 bg-opacity-30 px-3 py-1 rounded-full text-sm font-medium border border-blue-400">
                            ${cust.projects.length} Projects
                        </span>
                    </div>
                </div>

                <div class="p-6 bg-slate-50/50">
        `;

        if (cust.projects.length === 0) {
            html += `<p class="text-slate-500 italic">No projects found for this customer.</p>`;
        } else {
            // Projects Loop
            html += `<div class="grid gap-6">`;
            cust.projects.forEach(proj => {
                html += `
                    <div class="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div class="bg-slate-100 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                            <h3 class="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                ${escapeHtml(proj.name)}
                            </h3>
                            <span class="text-xs font-mono text-slate-500 bg-slate-200 px-2 py-1 rounded">ID: ${escapeHtml(proj.id)}</span>
                        </div>
                        
                        <div class="p-4 space-y-6">
                `;

                // MISSING DOCUMENTS
                if (proj.missingDocs.length > 0) {
                    html += `
                        <div>
                            <h4 class="text-sm font-bold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                Missing Documents
                            </h4>
                            <div class="overflow-x-auto rounded-lg border border-red-100">
                                <table class="min-w-full divide-y divide-red-100">
                                    <thead class="bg-red-50">
                                        <tr>
                                            ${missingDocs.header.map(h => `<th class="px-3 py-2 text-left text-xs font-medium text-red-700 uppercase tracking-wider">${escapeHtml(h)}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-red-50">
                                        ${proj.missingDocs.map(row => `
                                            <tr class="hover:bg-red-50/50 transition">
                                                ${row.map(cell => `<td class="px-3 py-2 whitespace-nowrap text-sm text-slate-600">${escapeHtml(truncate(cell))}</td>`).join('')}
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="flex items-center gap-2 text-green-600 text-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            No missing documents.
                        </div>
                    `;
                }

                // PROJECT FINANCE
                if (proj.projectFinance.length > 0) {
                    html += `
                        <div>
                            <h4 class="text-sm font-bold text-indigo-600 uppercase tracking-wide mb-2 flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Project Finance
                            </h4>
                            <div class="overflow-x-auto rounded-lg border border-indigo-100">
                                <table class="min-w-full divide-y divide-indigo-100">
                                    <thead class="bg-indigo-50">
                                        <tr>
                                            ${projectFinance.header.map(h => `<th class="px-3 py-2 text-left text-xs font-medium text-indigo-700 uppercase tracking-wider">${escapeHtml(h)}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody class="bg-white divide-y divide-indigo-50">
                                        ${proj.projectFinance.map(row => `
                                            <tr class="hover:bg-indigo-50/50 transition">
                                                ${row.map(cell => `<td class="px-3 py-2 whitespace-nowrap text-sm text-slate-600">${escapeHtml(truncate(cell))}</td>`).join('')}
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    `;
                }

                html += `
                        </div> <!-- End Project Body -->
                    </div> <!-- End Project Card -->
                `;
            });
            html += `</div>`; // End Grid
        }

        html += `
                </div>
            </div> <!-- End Customer Card -->
        `;
    });

    html += `
        </div>
        
        <footer class="mt-12 text-center text-slate-400 text-sm">
            <p>Generated automatically by ModCRM Branch Exporter</p>
        </footer>
    </div>
</body>
</html>
    `;
    
    return html;
}

module.exports = { generateHtmlReport };
