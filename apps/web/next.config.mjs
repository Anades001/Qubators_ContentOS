/** @type {import('next').NextConfig} */
const apiInternal = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // In dev (and when not behind Caddy) proxy /api/* to the API so auth cookies stay same-origin.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiInternal}/api/:path*` }];
  },
};

export default nextConfig;
