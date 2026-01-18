import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    const passwordHash = await bcrypt.hash('password', 10)

    // Create Admin
    const admin = await prisma.user.upsert({
        where: { username: 'admin' },
        update: {},
        create: {
            username: 'admin',
            passwordHash,
            role: 'admin',
        },
    })

    // Create User
    const user = await prisma.user.upsert({
        where: { username: 'user' },
        update: {},
        create: {
            username: 'user',
            passwordHash,
            role: 'user',
        },
    })

    console.log({ admin, user })
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
