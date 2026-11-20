import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Database migrations are read at runtime, so ship them with every server function.
  outputFileTracingIncludes: {
    '/**/*': ['./drizzle/**/*'],
  },
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default nextConfig;
