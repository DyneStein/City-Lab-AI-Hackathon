import os from "node:os";
import type { NextConfig } from "next";

/** Private Wi-Fi addresses of this machine, so a phone opening the QR code can load the dev app. */
const lanOrigins = Object.values(os.networkInterfaces())
  .flat()
  .filter((a) => a && a.family === "IPv4" && !a.internal)
  .map((a) => a!.address);

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  allowedDevOrigins: lanOrigins,
  // Native / heavy Node packages must not be bundled by Turbopack.
  serverExternalPackages: ["better-sqlite3", "pdfjs-dist", "tesseract.js"],
  turbopack: {
    // Watch only this app (a parent folder can contain unrelated, frequently written files).
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(), microphone=(self)" },
        ],
      },
    ];
  },
};

export default nextConfig;
