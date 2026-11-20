import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker/VPS install (ignored by Vercel).
  output: 'standalone',
  // Database migrations are read at runtime, so ship them with every server function.
  outputFileTracingIncludes: {
    '/**/*': ['./drizzle/**/*'],
  },
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
