import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: "/login",
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user
            const isPrivateRoute = nextUrl.pathname.startsWith("/(private)") ||
                ["/ambulance", "/hospital", "/traffic"].some(p => nextUrl.pathname.startsWith(p))

            if (isPrivateRoute) {
                if (isLoggedIn) return true
                return false // Redirect to login
            }
            return true
        },
        jwt({ token, user }) {
            if (user) {
                token.role = user.role
                token.metadata = user.metadata
            }
            return token
        },
        session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as string
                session.user.metadata = token.metadata as any
            }
            return session
        },
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig
