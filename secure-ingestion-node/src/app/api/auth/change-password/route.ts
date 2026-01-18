import { auth } from "@/auth"
import { prisma } from "@/lib/db"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { z } from "zod"

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6),
})

export async function POST(req: Request) {
    const session = await auth()

    if (!session || !session.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    try {
        const body = await req.json()
        const result = changePasswordSchema.safeParse(body)

        if (!result.success) {
            return NextResponse.json({ error: "Invalid input" }, { status: 400 })
        }

        const { currentPassword, newPassword } = result.data

        // Get user from DB to verify current password
        const user = await prisma.user.findUnique({
            where: { id: session.user.id }
        })

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 })
        }

        const passwordsMatch = await bcrypt.compare(currentPassword, user.passwordHash)

        if (!passwordsMatch) {
            return NextResponse.json({ error: "Incorrect current password" }, { status: 400 })
        }

        // Hash new password
        const newPasswordHash = await bcrypt.hash(newPassword, 10)

        // Update User
        await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash: newPasswordHash }
        })

        return NextResponse.json({ success: true, message: "Password updated successfully" })

    } catch (error) {
        console.error("Change password error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
