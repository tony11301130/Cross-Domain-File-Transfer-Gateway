const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');

// Initialize Prisma Client
const prisma = new PrismaClient();

// Configuration
const POLLING_INTERVAL = 2000; // 2 seconds
const SCAN_DURATION_MIN = 2000;
const SCAN_DURATION_MAX = 5000;
const STORAGE_ROOT = path.join(__dirname, '../storage');

const DIRS = {
    INGRESS: path.join(STORAGE_ROOT, 'ingress'),
    QUARANTINE: path.join(STORAGE_ROOT, 'quarantine'),
    EGRESS: path.join(STORAGE_ROOT, 'egress'),
};

// Utils
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function processFile(fileRecord) {
    console.log(`[Worker] Processing file: ${fileRecord.filename} (${fileRecord.id})`);

    // 1. Update status to SCANNING
    await prisma.fileRecord.update({
        where: { id: fileRecord.id },
        data: { status: 'SCANNING' },
    });

    // 2. Simulate Scan
    const scanTime = getRandomInt(SCAN_DURATION_MIN, SCAN_DURATION_MAX);
    console.log(`[Worker] Scanning... (Time: ${scanTime}ms)`);
    await sleep(scanTime);

    // 3. Determine Result (Mock Logic)
    // If filename contains "virus" -> Fail, else -> Pass
    const isMalicious = fileRecord.filename.toLowerCase().includes('virus');

    if (isMalicious) {
        console.log(`[Worker] Threat Detected! Moving to Quarantine.`);

        // Move file
        const sourcePath = path.join(DIRS.INGRESS, `${fileRecord.id.split('-')[0]}_*`); // Note: Real filename logic might differ, simplified here or need robust find
        // To be precise, we need the stored filename. 
        // In our upload route we stored as: `${transactionId}_${safeName}`. 
        // BUT we didn't save transactionId in DB in Phase 2 (oops, let's fix logic or rely on finding file)
        // Correction: In Phase 2 we only saved 'filename' (original name). 
        // We should probably list the directory to find the actual file on disk that matches or just trust our demo logic.
        // Let's improve the worker to find the file or simple mock movement for now if exact path is tricky without TX ID.
        // BETTER FIX: The upload route code: `const storedFilename = \`\${transactionId}_\${safeName}\``
        // The DB only has `safeName`.
        // Let's search the directory for files ending with `_${safeName}` for robust MVP.

        try {
            const files = await fs.readdir(DIRS.INGRESS);
            const targetFile = files.find(f => f.endsWith(`_${fileRecord.filename}`));

            if (targetFile) {
                await fs.rename(path.join(DIRS.INGRESS, targetFile), path.join(DIRS.QUARANTINE, targetFile));
            } else {
                console.error(`[Worker] File not found on disk: ${fileRecord.filename}`);
            }
        } catch (e) {
            console.error(`[Worker] File Op Error:`, e);
        }

        // Update DB
        await prisma.fileRecord.update({
            where: { id: fileRecord.id },
            data: { status: 'QUARANTINED' },
        });

    } else {
        console.log(`[Worker] Clean. Waiting for Approval.`);
        // Update DB to PENDING_APPROVAL
        await prisma.fileRecord.update({
            where: { id: fileRecord.id },
            data: { status: 'PENDING_APPROVAL' },
        });
    }
}

async function startWorker() {
    console.log('[Worker] Service Started. Monitoring for RECEIVED files...');

    // Ensure dirs exist
    await fs.mkdir(DIRS.INGRESS, { recursive: true });
    await fs.mkdir(DIRS.QUARANTINE, { recursive: true });
    await fs.mkdir(DIRS.EGRESS, { recursive: true });

    while (true) {
        try {
            // Find one file to process
            const job = await prisma.fileRecord.findFirst({
                where: { status: 'RECEIVED' },
                orderBy: { createdAt: 'asc' },
            });

            if (job) {
                await processFile(job);
            }
        } catch (error) {
            console.error('[Worker] Error:', error);
        }

        await sleep(POLLING_INTERVAL);
    }
}

startWorker();
