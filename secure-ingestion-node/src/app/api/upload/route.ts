import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"
import { enqueueJob } from "@/lib/queue"

export async function POST(req: Request) {
    const session = await auth()

    if (!session || !session.user || (session.user as any).role !== 'user') {
        return NextResponse.json({ error: "Unauthorized. Only 'user' role can upload." }, { status: 401 })
    }

    try {
        const formData = await req.formData()
        const file = formData.get("file") as File | null

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
        }

        const buffer = Buffer.from(await file.arrayBuffer())
        const originalName = file.name
        const size = file.size
        const transactionId = randomUUID()

        // Safety: prevent directory traversal
        const safeName = path.basename(originalName)
        const storedFilename = `${transactionId}_${safeName}` // Collision avoidance

        // Ensure ingress directory exists (just in case)
        const ingressDir = path.join(process.cwd(), "storage", "ingress")
        await mkdir(ingressDir, { recursive: true })

        const filePath = path.join(ingressDir, storedFilename)

        // Write file to disk
        await writeFile(filePath, buffer)

        // Create DB Record
        const record = await prisma.fileRecord.create({
            data: {
                filename: safeName,
                size: size,
                uploaderId: session.user.id!,
                status: "RECEIVED"
            }
        })

        // Fetch Transfer Config
        const transferConfig = await prisma.transferConfig.findUnique({
            where: { id: 'global' }
        })

        // Enqueue CDR Job
        if (process.env.NODE_ENV !== 'test') {
            try {
                await enqueueJob({
                    job_id: record.id, // Use DB record ID as Job ID for tracking
                    file_path: filePath, // Must be absolute path in container: /app/storage/ingress/...
                    file_type: file.type || 'application/octet-stream',
                    original_filename: originalName,
                    timestamp: Date.now() / 1000,
                    status: 'queued',
                    transfer_config: transferConfig ? {
                        enabled: transferConfig.enableTransfer,
                        host: transferConfig.host,
                        port: transferConfig.port,
                        username: transferConfig.username,
                        password: transferConfig.password,
                        target_dir: transferConfig.targetDir
                    } : null
                });
                console.log(`[Queue] Job ${record.id} enqueued for file ${safeName}`);
            } catch (queueError) {
                console.error("[Queue] Failed to enqueue job:", queueError);
                // Intentionally NOT returning error to user, as file is safe in DB. 
                // Background retry mechanism would be needed in production.
            }
        }

        return NextResponse.json({ success: true, fileId: record.id, transactionId })

    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
