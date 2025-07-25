import { withNextVideo } from "next-video/process";
import type { NextConfig } from "next";
import path from 'path';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        port: '',
        pathname: '/images/**',
      },
    ],
  },
  webpack: (config) => {
    config.module.rules.push({
      test: /encoder\.json$/,
      type: 'asset/resource',
      generator: {
        filename: 'static/chunks/[name][ext]'
      }
    });
    return config;
  }
};

export default withNextVideo(nextConfig);