import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

const createUserSchema = z.object({
    username: z.string().min(1),
})

export async function POST(req: Request) {
    const session = await auth()

    if (!session || !session.user || (session.user as any).role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 })
    }

    try {
        const body = await req.json()
        const result = createUserSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 })
        }

        const { username } = result.data

        const existingUser = await prisma.user.findUnique({
            where: { username }
        })

        if (existingUser) {
            return NextResponse.json({ error: "Username already exists" }, { status: 400 })
        }

        const passwordHash = await bcrypt.hash("password", 10) // Default password

        const newUser = await prisma.user.create({
            data: {
                username,
                passwordHash,
                role: "user", // Always create 'user' role
            }
        })

        return NextResponse.json({ success: true, user: newUser })
    } catch (error) {
        console.error("Create user error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export async function DELETE(req: Request) {
    const session = await auth()

    if (!session || !session.user || (session.user as any).role !== 'admin') {
        return NextResponse.json({ error: "Unauthorized. Admin role required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("id")

    if (!userId) {
        return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    try {
        const userToDelete = await prisma.user.findUnique({ where: { id: userId } })

        if (!userToDelete) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        if (userToDelete.role === 'admin') {
            return NextResponse.json({ error: "Cannot delete admin users" }, { status: 403 })
        }

        await prisma.user.delete({ where: { id: userId } })

        return NextResponse.json({ success: true, message: "User deleted" })

    } catch (error) {
        console.error("Delete user error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
