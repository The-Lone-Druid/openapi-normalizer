import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: ['src/cli.ts'],
    format: ['cjs'],
    sourcemap: true,
  },
]);
