export function isDemoMode(): boolean {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    
    return (
        !supabaseUrl ||
        supabaseUrl.includes("dummy") ||
        !supabaseKey ||
        supabaseKey.includes("dummy") ||
        supabaseKey.includes("your-service-role-key-here")
    );
}

export const MOCK_REMAINING = 5;
