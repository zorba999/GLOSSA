/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // genlayer-js pulls in viem, which ships ESM that Next's server bundler
  // otherwise tries to pre-optimise. Everything here runs client-side anyway.
  transpilePackages: ["genlayer-js"],
};

export default nextConfig;
