import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
            if (isOnDashboard) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
                return false; // Redirect unauthenticated users to login page
            }

            const isOnAdmin = nextUrl.pathname.startsWith('/admin');
            if (isOnAdmin) {
                if (!isLoggedIn) return false;
                // Ideally check role here, but role is on token which might not be fully available in this limited middleware context without DB.
                // However, we can check basic auth here, and double check role in Layout/Page.
                // For stricter middleware role check, we need to decode the token.
                // Given the auth object has user, let's trust it for existence, but verify role in layout.
                return true;
            }

            if (isLoggedIn && nextUrl.pathname === '/login') {
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
        async session({ session, token }) {
            if (token.sub && session.user) {
                (session.user as any).role = (token as any).role;
                (session.user as any).id = token.sub;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
            }
            return token;
        }
    },
    providers: [], // Add providers with an empty array for now
    trustHost: true,
    debug: true,
} satisfies NextAuthConfig;
