import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { SupabaseAdapter } from "@auth/supabase-adapter"
import { authConfig } from "./auth.config"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"

const supabase = createClient(supabaseUrl, supabaseKey)

export const {
    handlers: { GET, POST },
    auth,
    signIn,
    signOut
} = NextAuth({
    ...authConfig,
    adapter: SupabaseAdapter({
        url: supabaseUrl,
        secret: supabaseKey,
    }) as any,
    session: { strategy: "jwt" },
    providers: [
        Credentials({
            async authorize(credentials) {
                if (!credentials) return null

                const { role, identifier, password, extraIdentifier } = credentials

                // FOR HACKATHON DEMO: Static credentials check
                // In production, this would verify against Supabase Auth or DB

                let userPayload = null

                if (role === "ambulance_driver") {
                    if (identifier === "EMP001" && extraIdentifier === "VEH001" && password === "password123") {
                        userPayload = {
                            id: "demo-driver-uuid",
                            name: "Demo Driver",
                            email: "driver@demo.com",
                            role: "ambulance_driver",
                            metadata: { employeeId: "EMP001", vehicleNumber: "VEH001" }
                        }
                    }
                } else if (role === "hospital_staff") {
                    if (identifier === "HOSP001" && password === "password123") {
                        userPayload = {
                            id: "demo-hospital-uuid",
                            name: "Demo Hospital",
                            email: "hospital@demo.com",
                            role: "hospital_staff",
                            metadata: { hospitalId: "HOSP001" }
                        }
                    }
                } else if (role === "traffic_police") {
                    if (identifier === "JUNC001" && password === "password123") {
                        userPayload = {
                            id: "demo-traffic-uuid",
                            name: "Demo Traffic",
                            email: "traffic@demo.com",
                            role: "traffic_police",
                            metadata: { junctionId: "JUNC001" }
                        }
                    }
                }

                if (userPayload) {
                    // Log session and audit action (Requirement 5)
                    try {
                        await Promise.all([
                            supabase.from('user_sessions').insert({
                                user_id: userPayload.id,
                                device_info: { demo: true },
                                ip_address: "127.0.0.1"
                            }),
                            supabase.from('audit_logs').insert({
                                user_id: userPayload.id,
                                action: 'LOGIN_SUCCESS',
                                entity_type: 'user',
                                details: { role: userPayload.role }
                            })
                        ])
                    } catch (e) {
                        console.error("Tracking log error:", e)
                    }
                    return userPayload
                }

                return null
            },
        }),
    ],
})
