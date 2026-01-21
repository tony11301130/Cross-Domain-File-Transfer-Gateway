
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { enqueueTransferJob } from '@/lib/queue';
import { getLogger } from '@/lib/logger';
import path from 'path';

const logger = getLogger('API:Approve');

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { fileId } = body;

        if (!fileId) {
            return NextResponse.json({ error: 'Missing fileId' }, { status: 400 });
        }

        // 1. Fetch File Record
        const record = await prisma.fileRecord.findUnique({
            where: { id: fileId }
        });

        if (!record) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // 2. Fetch Global Transfer Config
        const transferConfig = await prisma.transferConfig.findUnique({
            where: { id: 'global' }
        });

        if (!transferConfig || !transferConfig.enableTransfer) {
            return NextResponse.json({ error: 'Transfer is disabled globally' }, { status: 400 });
        }

        // 3. Determine Safe Path (Standardized CDR Output)
        // Structure: /app/storage/results/{jobId}/safe/{filename}
        const storageRoot = process.env.STORAGE_ROOT || '/app/storage'; // Should match Docker volume mapping
        // We know the worker uses relative "storage" path logic, but here in Node we need absolute path for the Transfer Worker?
        // Actually, the Transfer Worker is also in Docker and mounts storage at /app/storage.
        // So we should construct the path relative to the shared volume root.

        // CDR Worker output: storage/results/{job_id}/safe/filename
        // Transfer Worker expects: absolute path inside its container.

        // Let's assume standardized path:
        const safePath = `/app/storage/results/${fileId}/safe/${path.basename(record.name)}`;

        // 4. Construct Transfer Job
        const transferJob = {
            job_id: fileId,
            source_path: safePath,
            remote_filename: record.name, // Use original name
            config: {
                host: transferConfig.host,
                port: transferConfig.port,
                username: transferConfig.username,
                password: transferConfig.password || undefined,
                target_dir: transferConfig.targetDir
            }
        };

        // 5. Enqueue
        await enqueueTransferJob(transferJob);

        // 6. Update Status
        await prisma.fileRecord.update({
            where: { id: fileId },
            data: { status: 'TRANSFER_QUEUED' }
        });

        logger.info(`Transfer initiated for ${fileId}`);
        return NextResponse.json({ success: true });

    } catch (error: any) {
        logger.error(`Approval failed: ${error.message}`);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
