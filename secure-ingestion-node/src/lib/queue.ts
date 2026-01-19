import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// Define strict interface matching Python queue_manager.py
export interface CdrJob {
    job_id: string;
    file_path: string;
    file_type: string;
    original_filename: string;
    timestamp: number;
    status: 'queued';
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

export async function enqueueJob(job: CdrJob): Promise<void> {
    const client = getRedisClient();
    // Match Python QUEUE_NAME = "cdr_tasks"
    await client.rpush('cdr_tasks', JSON.stringify(job));
    // Match Python RESULT_PREFIX = "cdr_result:"
    await client.setex(`cdr_result:${job.job_id}`, 3600, JSON.stringify(job));
}
