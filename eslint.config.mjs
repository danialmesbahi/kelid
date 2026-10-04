// قواعد کد برای همهٔ بسته‌ها: npm run lint
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/dist-electron/**', '**/release/**', 'graphify-out/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // فقط دو قاعدهٔ اصلی hookها؛ قواعد تازهٔ React Compiler بازنویسی گسترده می‌خواهند.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // متغیری که عمداً کنار گذاشته می‌شود با _ شروع می‌شود.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
    },
  },
  {
    // کد Node: پروسهٔ اصلی Electron، اسکریپت‌ها، تست‌ها و تنظیمات ابزارها
    files: ['apps/desktop/**', 'scripts/**', 'e2e/**', '**/*.test.ts', '**/*.config.{ts,mjs,js}', 'packages/core/src/sql/nodeDriver.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
    rules: { '@typescript-eslint/no-require-imports': 'off' },
  },
  // قالب‌بندی کار Prettier است، نه ESLint.
  prettier,
);
