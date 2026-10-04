import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Rounds were removed in v3 (pitches launch when ripe); old round links land on the feed.
  async redirects() {
    return [
      { source: "/m/:id", destination: "/", permanent: false },
      { source: "/r/:id", destination: "/", permanent: false },
    ];
  },
  /* config options here */
};

export default nextConfig;
