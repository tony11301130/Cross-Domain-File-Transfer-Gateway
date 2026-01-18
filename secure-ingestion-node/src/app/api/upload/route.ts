import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { randomUUID } from "crypto"

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

        return NextResponse.json({ success: true, fileId: record.id, transactionId })

    } catch (error) {
        console.error("Upload error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
