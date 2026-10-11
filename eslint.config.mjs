import nextConfig from 'eslint-config-next/core-web-vitals';

const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '.tools/**',
      'artifacts/**',
      'migrations/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...nextConfig,
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      // Standard client-side data fetching (fetch then setState) is used throughout the app;
      // this compiler heuristic flags the pattern itself rather than an actual defect.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
];

export default config;