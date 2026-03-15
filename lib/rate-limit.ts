import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dummy.supabase.co"
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "dummy-key"
const supabase = createClient(supabaseUrl, supabaseKey)

export async function checkRateLimit(ip: string, endpoint: string, limit: number = 5): Promise<{ success: boolean; remaining: number }> {
    try {
        // Clean up old entries first (demonstrative for hackathon, ideally handled by cron)
        await supabase.rpc('clean_old_rate_limits')

        const { data, error } = await supabase
            .from('api_rate_limits')
            .select('*')
            .eq('ip_address', ip)
            .eq('endpoint', endpoint)
            .single()

        const now = new Date()

        if (error && error.code === 'PGRST116') {
            // No entry exists, create one
            await supabase.from('api_rate_limits').insert({
                ip_address: ip,
                endpoint: endpoint,
                request_count: 1,
                last_request_at: now.toISOString()
            })
            return { success: true, remaining: limit - 1 }
        }

        if (data) {
            const lastRequest = new Date(data.last_request_at)
            const hourAgo = new Date(now.getTime() - (60 * 60 * 1000))

            if (lastRequest < hourAgo) {
                // Entry is old, reset it
                await supabase.from('api_rate_limits').update({
                    request_count: 1,
                    last_request_at: now.toISOString()
                }).eq('id', data.id)
                return { success: true, remaining: limit - 1 }
            }

            if (data.request_count >= limit) {
                return { success: false, remaining: 0 }
            }

            // Increment count
            await supabase.from('api_rate_limits').update({
                request_count: data.request_count + 1,
                last_request_at: now.toISOString()
            }).eq('id', data.id)

            return { success: true, remaining: limit - (data.request_count + 1) }
        }

        return { success: true, remaining: limit }
    } catch (e) {
        console.error("Rate limit check error:", e)
        return { success: true, remaining: 1 } // Allow if error to avoid blocking users
    }
}
