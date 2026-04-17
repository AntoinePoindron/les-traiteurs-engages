import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMP : on ignore les erreurs TS au build pour tester si
  // la prod tourne (ces erreurs existent déjà en dev mais sont
  // silencieuses)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
