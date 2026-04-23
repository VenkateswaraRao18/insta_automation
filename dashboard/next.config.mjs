/** @type {import('next').NextConfig} */
const backend = process.env.API_PROXY_TARGET || "http://127.0.0.1:3000";

const nextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backend}/api/:path*` },
      { source: "/output/:path*", destination: `${backend}/output/:path*` }
    ];
  }
};

export default nextConfig;
