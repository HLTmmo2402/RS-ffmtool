/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Import chia lô 150 đơn + source_raw có thể lớn hơn mặc định 1MB của server action.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
