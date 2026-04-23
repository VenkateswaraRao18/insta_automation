/** @type {import('next').NextConfig} */
const raw = process.env.API_PROXY_TARGET || "http://127.0.0.1:3000";
// Trailing slash + destination = ...//api/... can break the upstream; Express may 404.
const backend = String(raw).trim().replace(/\/+$/, "");

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/output/:path*", destination: `${backend}/output/:path*` }
    ];
  }
};

export default nextConfig;
