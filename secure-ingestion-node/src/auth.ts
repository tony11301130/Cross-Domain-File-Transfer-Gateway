import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { logLoginError } from "@/lib/logger"
import { authConfig } from "@/auth.config"

async function getUser(username: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { username },
        });
        return user;
    } catch (error) {
        console.error("Failed to fetch user:", error);
        logLoginError("Database error during user fetch", error);
        throw new Error("Failed to fetch user.");
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            name: 'Credentials',
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ username: z.string(), password: z.string().min(1) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { username, password } = parsedCredentials.data;
                    const user = await getUser(username);
                    if (!user) {
                        logLoginError("Login failed: User not found", { username });
                        return null;
                    }

                    const passwordsMatch = await bcrypt.compare(password, user.passwordHash);
                    if (passwordsMatch) return user;

                    logLoginError("Login failed: Password mismatch", { username });
                } else {
                    logLoginError("Login failed: Invalid input format", { error: parsedCredentials.error });
                }

                console.log("Invalid credentials");
                return null;
            },
        }),
    ],
})
