const { PrismaClient } = require('@prisma/client');
const fs = require('fs/promises');
const path = require('path');
const Redis = require('ioredis');

// Initialize Prisma Client
const prisma = new PrismaClient();

// Configuration
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const REDIS_CONNECTION = { host: REDIS_HOST, port: Number(REDIS_PORT) };
const redis = new Redis(REDIS_CONNECTION);
const RESULTS_QUEUE = 'cdr_results';
const RESULT_PREFIX = 'cdr_result:';

const STORAGE_ROOT = path.join(__dirname, '../storage');

const DIRS = {
    INGRESS: path.join(STORAGE_ROOT, 'ingress'),
    QUARANTINE: path.join(STORAGE_ROOT, 'quarantine'),
    EGRESS: path.join(STORAGE_ROOT, 'egress'),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function updatePrisma(jobId, statusData) {
    console.log(`[Worker] Updating Prisma for job ${jobId}: ${statusData.status}`);

    const statusMap = {
        'completed': 'PENDING_APPROVAL',
        'failed': 'QUARANTINED',
        'waiting_password': 'RECEIVED' // Or a new state if UI supports it
    };

    const prismaStatus = statusMap[statusData.status] || 'RECEIVED';

    try {
        await prisma.fileRecord.update({
            where: { id: jobId },
            data: {
                status: prismaStatus,
                cdrReport: JSON.stringify({
                    scanResult: statusData.status === 'completed' ? 'SUCCESS' : 'FAILED',
                    details: statusData.error || (statusData.report ? statusData.report[statusData.report.length - 1]?.details : 'Processed'),
                    method: statusData.method,
                    duration: statusData.duration,
                    objectsScanned: statusData.report ? [...new Set(statusData.report.map(l => l.component))] : []
                })
            }
        });

        // If failed, move to quarantine
        if (statusData.status === 'failed') {
            const fileName = path.basename(statusData.file_path);
            const sourcePath = path.join(DIRS.INGRESS, fileName);
            const destPath = path.join(DIRS.QUARANTINE, fileName);
            try {
                await fs.access(sourcePath);
                await fs.rename(sourcePath, destPath);
                console.log(`[Worker] Quarantined: ${fileName}`);
            } catch (e) {
                console.warn(`[Worker] File not found or move failed: ${fileName}`);
            }
        }
    } catch (e) {
        console.error(`[Worker] Prisma Update failed:`, e.message);
    }
}

async function startWorker() {
    console.log('[Worker] Results Listener Started. Monitoring Redis for results...');

    // Ensure dirs exist
    await fs.mkdir(DIRS.INGRESS, { recursive: true });
    await fs.mkdir(DIRS.QUARANTINE, { recursive: true });
    await fs.mkdir(DIRS.EGRESS, { recursive: true });

    while (true) {
        try {
            // Blocking pop from results queue
            const result = await redis.blpop(RESULTS_QUEUE, 0); // Wait indefinitely
            if (result) {
                const jobId = result[1];
                const statusJson = await redis.get(`${RESULT_PREFIX}${jobId}`);
                if (statusJson) {
                    const statusData = JSON.parse(statusJson);
                    await updatePrisma(jobId, statusData);
                }
            }
        } catch (error) {
            console.error('[Worker] Loop Error:', error);
            await sleep(2000);
        }
    }
}

startWorker();
