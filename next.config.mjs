/** @type {import('next').NextConfig} */
const nextConfig = {
    // Standalone output for optimal Vercel cold-start performance
    output: "standalone",

    images: {
        remotePatterns: [
            { protocol: "https", hostname: "cdn-icons-png.flaticon.com" },
            { protocol: "https", hostname: "unpkg.com" },
        ],
    },

    // Silence Leaflet SSR warnings (window is undefined on server)
    webpack(config) {
        config.resolve.fallback = { ...config.resolve.fallback, fs: false };
        return config;
    },

    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options",  value: "nosniff" },
                    { key: "X-Frame-Options",         value: "SAMEORIGIN" },
                    { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
                ],
            },
        ];
    },
};

export default nextConfig;
