import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-XSS-Protection", value: "1; mode=block" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      // 'unsafe-inline' required: Next.js App Router injects inline scripts for RSC streaming
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-scripts.com",
      // Inline styles required by Tailwind v4
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Fonts
      "font-src 'self' https://fonts.gstatic.com",
      // Images: self + data URIs (globe textures) + any https
      "img-src 'self' data: blob: https:",
      // WebGL canvas needs blob: workers; three.js needs worker-src
      "worker-src 'self' blob:",
      // connect-src: self + Vercel analytics + any HTTPS APIs the client calls
      "connect-src 'self' https:",
      // Frames
      "frame-ancestors 'none'",
      // Objects
      "object-src 'none'",
      // Base URI
      "base-uri 'self'",
      // Default
      "default-src 'self'",
    ]
      .join("; ")
      .trim(),
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws", "@neondatabase/serverless", "@prisma/adapter-neon", "pdf-parse"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
