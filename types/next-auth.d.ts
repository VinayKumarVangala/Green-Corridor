import { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: string
            metadata?: any
        } & DefaultSession["user"]
    }

    interface User {
        role: string
        metadata?: any
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        role?: string
        metadata?: any
    }
}
