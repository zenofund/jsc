import rootConfig from '../tailwind.config.js';

// Keep both frontend entry points on the same theme and token mapping.
// Only the content globs differ because this config runs with `src/` as root.
export default {
  ...rootConfig,
  content: [
    './index.html',
    './**/*.{ts,tsx,js,jsx,html}',
    '!./backend/**/*',
    '!./node_modules/**/*',
  ],
};
