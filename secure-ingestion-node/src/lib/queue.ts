import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

const QUEUE_NAME = "cdr_tasks";
const RESULT_PREFIX = "cdr_result:";
const TRANSFER_QUEUE_NAME = "transfer_tasks";

export interface TransferConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    target_dir: string;
}

export interface CDRJob {
    job_id: string;
    file_path: string;
    file_type: string;
    original_filename: string;
    timestamp: number;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    // transfer_config removed - Phase 2
}

export interface TransferJob {
    job_id: string;
    source_path: string; // The path to the safe file
    remote_filename: string;
    config: TransferConfig;
}

// Singleton Redis Client
let redis: Redis | null = null;

export function getRedisClient(): Redis {
    if (!redis) {
        redis = new Redis({
            host: REDIS_HOST,
            port: REDIS_PORT,
            lazyConnect: true, // Avoid connecting during build time
        });
    }
    return redis;
}

export async function enqueueJob(job: CDRJob): Promise<string> {
    const client = getRedisClient();
    await client.rpush(QUEUE_NAME, JSON.stringify(job));
    // Set initial status
    await client.setex(`${RESULT_PREFIX}${job.job_id}`, 3600, JSON.stringify(job));
    return job.job_id;
}

export async function enqueueTransferJob(job: TransferJob): Promise<void> {
    const client = getRedisClient();
    await client.rpush(TRANSFER_QUEUE_NAME, JSON.stringify(job));
    console.log(`[Queue] Enqueued transfer job for ${job.job_id}`);
}

export async function submitPassword(jobId: string, password: string): Promise<boolean> {
    const client = getRedisClient();
    const key = `${RESULT_PREFIX}${jobId}`;
    const data = await client.get(key);

    if (!data) return false;

    const task = JSON.parse(data);
    task.status = 'queued';
    task.password = password;

    // Update result in Redis
    await client.setex(key, 3600, JSON.stringify(task));
    // Push back to task queue
    await client.rpush('cdr_tasks', JSON.stringify(task));

    return true;
}
