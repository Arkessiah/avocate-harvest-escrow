/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Network config and deployment addresses live in ../deploy, shared with the deploy
  // scripts, so the app never carries a hand-copied address.
  experimental: { externalDir: true },
};

export default nextConfig;
