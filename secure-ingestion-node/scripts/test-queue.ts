import { enqueueJob, getRedisClient } from '../src/lib/queue';
import { v4 as uuidv4 } from 'uuid';

async function test() {
    const jobId = uuidv4();
    console.log(`Testing with Job ID: ${jobId}`);

    await enqueueJob({
        job_id: jobId,
        file_path: '/tmp/test.txt',
        file_type: 'text/plain',
        original_filename: 'test.txt',
        timestamp: Date.now() / 1000,
        status: 'queued'
    });

    console.log('Job enqueued. Checking Redis...');
    const client = getRedisClient();
    const result = await client.get(`cdr_result:${jobId}`);
    console.log('Result in Redis:', result);

    if (result && result.includes(jobId)) {
        console.log('PASS');
    } else {
        console.log('FAIL');
        process.exit(1);
    }

    client.disconnect();
}

test().catch(console.error);
