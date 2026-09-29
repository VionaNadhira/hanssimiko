import {FlatCompat} from '@eslint/eslintrc';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({baseDirectory: __dirname});

const eslintConfig = [
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'cache/**', 'broadcast/**', 'lib/**', 'next-env.d.ts'],
  },
  {
    // Build and codegen scripts are CLIs: writing to stdout is their job.
    files: ['scripts/**/*.mjs'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_'}],
      '@typescript-eslint/consistent-type-imports': ['error', {prefer: 'type-imports'}],
      eqeqeq: ['error', 'always', {null: 'ignore'}],
      'no-console': 'off',
    },
  },
];

export default eslintConfig;
