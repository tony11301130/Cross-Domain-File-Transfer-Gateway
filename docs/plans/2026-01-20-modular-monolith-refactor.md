# [Modular Monolith Refactoring] Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 將專案重構為模組化單體架構 (Modular Monolith)，統一 Docker 環境並建立嚴格的 Redis 佇列合約。

**Architecture:** 建立根目錄 `docker-compose.yml` 統一編排 Next.js、Python Worker 與 Redis。設定 `gateway-storage` Volume 供跨容器檔案共享。Next.js 透過介面合約將工作推送到 Redis，Python Worker 負責消費。

**Tech Stack:** Docker Compose, Node.js (Next.js), Python, Redis (ioredis)

---

### Task 1: 基礎設施編排 (Infrastructure Orchestration)

**Files:**
- Create: `docker-compose.yml`

**Step 1: 建立根目錄 Docker Compose**

撰寫 `docker-compose.yml` 定義完整堆疊。

```yaml
version: '3.8'

services:
  # 訊息代理人
  redis:
    image: redis:alpine
    container_name: gateway-redis
    ports:
      - "6379:6379"
    networks:
      - gateway-network

  # 網頁入口 (Next.js)
  ingestion-web:
    build: 
      context: ./secure-ingestion-node
      dockerfile: Dockerfile
    container_name: ingestion-web
    ports:
      - "3000:3000"
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - DATABASE_URL=file:/app/db/dev.db
      - NEXTAUTH_SECRET=supersecret123
      - NEXTAUTH_URL=http://localhost:3000
    volumes:
      - gateway-storage:/app/storage
      - ./secure-ingestion-node/prisma:/app/prisma
    depends_on:
      - redis
    networks:
      - gateway-network

  # CDR 引擎 (Python)
  cdr-worker:
    build: 
      context: ./services/cdr
      dockerfile: Dockerfile
    container_name: cdr-worker
    command: ["python", "worker.py"]
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - UPLOAD_DIR=/app/storage/uploads
    volumes:
      - gateway-storage:/app/storage
    depends_on:
      - redis
    networks:
      - gateway-network

volumes:
  gateway-storage:

networks:
  gateway-network:
    driver: bridge
```

**Step 2: 驗證設定檔 (Validate Config)**

Run: `docker-compose config`
Expected: 輸出完整的 YAML 設定，無錯誤訊息。

**Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add root docker-compose for modular monolith architecture"
```

---

### Task 2: Node.js Queue 介面實作 (Queue Interface Implementation)

**Files:**
- Create: `secure-ingestion-node/src/lib/queue.ts`
- Test: `secure-ingestion-node/scripts/test-queue.ts` (暫時測試腳本)

**Step 1: 安裝 Redis 依賴**

Run: `cd secure-ingestion-node && npm install ioredis && npm install -D @types/ioredis`

**Step 2: 建立 Queue 合約與 Client**

Create `secure-ingestion-node/src/lib/queue.ts`:

```typescript
import Redis from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');

// 定義與 Python queue_manager.py 完全一致的介面
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
      lazyConnect: true, // 避免在建置時連線
    });
  }
  return redis;
}

export async function enqueueJob(job: CdrJob): Promise<void> {
  const client = getRedisClient();
  // 與 Python 的 QUEUE_NAME = "cdr_tasks" 保持一致
  await client.rpush('cdr_tasks', JSON.stringify(job));
  // 與 Python 的 RESULT_PREFIX = "cdr_result:" 保持一致
  await client.setex(`cdr_result:${job.job_id}`, 3600, JSON.stringify(job));
}
```

**Step 3: 撰寫測試腳本**

Create `secure-ingestion-node/scripts/test-queue.ts`:

```typescript
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
```

**Step 4: 執行測試**

Run: 
1. `docker-compose up -d redis` (先啟動 Redis)
2. `cd secure-ingestion-node && npx tsx scripts/test-queue.ts`

Expected: Output "PASS"

**Step 5: Commit**

```bash
git add secure-ingestion-node/src/lib/queue.ts secure-ingestion-node/package.json secure-ingestion-node/package-lock.json
git commit -m "feat(ingestion): implement redis queue interface for cdr"
```

---

### Task 3: 整合上傳 API (Upload API Integration)

**Files:**
- Modify: `secure-ingestion-node/src/app/api/upload/route.ts`

**Step 1: 修改 API 處理邏輯**

修改 `secure-ingestion-node/src/app/api/upload/route.ts`，在檔案寫入後呼叫 `enqueueJob`。

*注意：確保檔案寫入路徑使用環境變數或固定為 `/app/storage/uploads`，以便 Docker Volume 對應。*

```typescript
// ... imports
import { enqueueJob } from '@/lib/queue';
import { v4 as uuidv4 } from 'uuid';
// ... inside POST handler

// [假設已有檔案寫入邏輯，在此處插入 Queue 邏輯]
// const savedFilePath = ...; // 實際在磁碟上的路徑
// const originalName = ...;
// const fileType = ...;

const jobId = uuidv4();
if (process.env.NODE_ENV !== 'test') { // 避免單元測試卡住
    await enqueueJob({
        job_id: jobId,
        file_path: savedFilePath, // 確保這是容器內的絕對路徑
        file_type: fileType,
        original_filename: originalName,
        timestamp: Date.now() / 1000,
        status: 'queued'
    });
}

// Return response with jobId
```

**Step 2: 驗證 API**

Run:
1. `docker-compose up -d --build` (全端啟動)
2. 使用 `curl` 或 Postman 上傳檔案。
3. `docker logs cdr-worker`

Expected: Python Worker 輸出日誌顯示收到工作。

**Step 3: Commit**

```bash
git add secure-ingestion-node/src/app/api/upload/route.ts
git commit -m "feat(api): integrate upload route with cdr queue"
```
