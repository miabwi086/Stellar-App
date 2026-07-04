// next.config.js
import * as fs from 'node:fs/promises';
import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Izinkan akses dari IP tertentu (opsional)
  allowedDevOrigins: ['192.168.8.130'],

  // Konfigurasi server untuk development
  server: {
    https: {
      key: fs.readFileSync(path.join(__dirname, 'certificates/localhost-key.pem')),
      cert: fs.readFileSync(path.join(__dirname, 'certificates/localhost.pem')),
    },
  },
};

module.exports = nextConfig;