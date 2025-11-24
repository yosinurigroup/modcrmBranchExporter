// trigger.js
const { processBranch } = require('./index');

// Dummy payload matching your Apps Script structure
const payload = {
    branchName: 'ROMANO- Vardi & Danny',
    branchId: '6a5f7d0a',
    projectsData: [
        { projects: '5CAD3A2C', customerId: 'CID B6C795C2', projectFolders: 'https://drive.google.com/drive/folders/1SLlO8Exj7vLo6Obpg9qUzzNEG01OcCJ8' },
        { projects: 'C305B06F', customerId: 'CID B6C795C2', projectFolders: 'https://drive.google.com/drive/folders/1JUhWCcK4ensDcRZX3ewK00dgqtGnaE0H' },
        { projects: 'C6E36746', customerId: 'CID 014CE6CB', projectFolders: 'https://drive.google.com/drive/folders/11re3xXq_LSfHp03N9R8tny4oJi5Y7qmZ' }
    ],
    customersData: [
        {
            fullName: 'Rosie Crittenden',
            customerId: 'CID B6C795C2',
            folderlinks: 'https://drive.google.com/drive/folders/1LcvCdLqIXPy4neQfgZNC5AcqbFaOOnOJ'
        },
        {
            fullName: 'Dorothy Caldwell',
            customerId: 'CID 014CE6CB',
            folderlinks: 'https://drive.google.com/drive/folders/1h4pvHha4P7XyRZqtUEFH8A2IdoYAzTtN'
        }
        // add more customers as needed
    ]
};

// Invoke the process and handle errors
processBranch(payload)
    .then(() => {
        console.log('Branch export completed successfully.');
    })
    .catch((err) => {
        console.error('Error processing branch:', err);
    });
