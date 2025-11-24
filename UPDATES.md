# ModCRM Updates - Project Folder Filtering

## Changes Made

### 1. Enhanced Project Filtering
**File:** `index.js` - `filterData()` function

- **Added Branch Name Matching**: Projects sheet now filters by BOTH:
  - Customer ID (existing)
  - Branch Name (new)
- **Why**: Ensures only projects belonging to the specific branch are copied to the new spreadsheet

### 2. Selective Subfolder Copying
**File:** `index.js` - `copyFolderRecursively()` function

- **Added `allowedFolderNames` Parameter**: Function now accepts a list of allowed folder names
- **Smart Matching**: Uses fuzzy matching (case-insensitive, partial matches)
- **Skips Unwanted Folders**: Subfolders not in the `projectFolders` list are skipped
- **Why**: Only copies project-specific subfolders from customer directories, avoiding unnecessary data duplication

### 3. Updated Payload Structure
**New Field:** `projectFolders` in each project object

```json
{
  "projectsData": [
    {
      "projects": "5CAD3A2C",
      "projectFolders": "Interior Paint"  // NEW FIELD
    }
  ],
  "customersData": [...],
  "branchName": "ROMANO- Vardi & Danny",
  "branchId": "6a5f7d0a"
}
```

## How It Works

### Example Scenario:

**Payload:**
```json
{
  "projectsData": [
    { "projects": "5CAD3A2C", "projectFolders": "Interior Paint" },
    { "projects": "C305B06F", "projectFolders": "Exterior Siding" }
  ],
  "customersData": [
    {
      "fullName": "Rosie Crittenden",
      "customerId": "CID B6C795C2",
      "folderlinks": "https://drive.google.com/drive/folders/abc123"
    }
  ],
  "branchName": "ROMANO- Vardi & Danny",
  "branchId": "6a5f7d0a"
}
```

### What Happens:

1. **Google Sheet Filtering:**
   - FROM: Projects sheet in source
   - FILTERS: 
     - Customer ID = "CID B6C795C2" ✓
     - Branch Name = "ROMANO- Vardi & Danny" ✓
   - RESULT: Only rows matching BOTH criteria are copied

2. **Folder Copying:**
   - FROM: Rosie Crittenden's folder (`abc123`)
   - ALLOWED SUBFOLDERS: ["Interior Paint", "Exterior Siding"]
   - COPIES: Only subfolders with names containing "Interior Paint" or "Exterior Siding"
   - SKIPS: All other subfolders (e.g., "Kitchen Remodel", "Roof Repair")

## Testing

### Updated Test Payload (`trigger.js`):
```javascript
const payload = {
    branchName: 'ROMANO- Vardi & Danny',
    branchId: '6a5f7d0a',
    projectsData: [
        { projects: '5CAD3A2C', projectFolders: 'Interior Paint' },
        { projects: 'C305B06F', projectFolders: 'Exterior Siding' },
        { projects: 'C6E36746', projectFolders: 'Bathroom Remodel' }
    ],
    customersData: [...]
};
```

### Console Output Example:
```
Filtering for customer IDs: [ 'CID B6C795C2', 'CID 014CE6CB' ]
Filtering for branch name: ROMANO- Vardi & Danny
Filtered Projects: 3 rows, Customers: 2 rows
Project folders to copy: [ 'Interior Paint', 'Exterior Siding', 'Bathroom Remodel' ]
Copying folder Rosie Crittenden (abc123) with filters: [ 'Interior Paint', 'Exterior Siding', 'Bathroom Remodel' ]
Skipping folder: Kitchen Remodel (not in allowed list)
Copied file: floor_plan.pdf
```

## AppSheet Webhook Body (Updated)

```json
{
  "projectsData": [
    <<Start: SELECT(Projects[Project ID],[Branch Name]=[_THISROW].[Dropdown])>>
    {
      "projects": "<<[Project ID]>>",
      "projectFolders": "<<[Project Folder]>>"
    }<<END>>
  ],
  "customersData": [
    <<Start: SELECT(Unique customers[Project ID],[Branch Name]=[_THISROW].[Dropdown])>>
    {
      "fullName": "<<[Customer Name]>>",
      "customerId": "<<[Customer ID]>>",
      "folderlinks": "<<[Customer ID].[Customer Files]>>"
    }<<END>>
  ],
  "branchName": "<<[Dropdown]>>",
  "branchId": "<<[dropid]>>"
}
```

## Deployment

- ✅ Code pushed to GitHub
- ✅ Render will auto-deploy
- 🔗 Webhook URL: `https://modcrmbranchexporter.onrender.com/webhook/branch-export`

## Benefits

1. **Reduced Data Duplication**: Only relevant project folders are copied
2. **Improved Performance**: Fewer files to copy = faster execution
3. **Better Organization**: Spreadsheets only contain branch-specific data
4. **Flexible Filtering**: Branch name + Customer ID ensures precise data matching
