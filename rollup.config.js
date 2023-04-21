import ts from '@rollup/plugin-typescript';
import { builtinModules, createRequire } from 'node:module';
import { defineConfig } from 'rollup';
import flatDts from 'rollup-plugin-flat-dts';
import typescript from 'typescript';

const req = createRequire(import.meta.url);
const pkg = req('./package.json');
const externals = new Set([...builtinModules, ...Object.keys(pkg.dependencies ?? {})]);

export default defineConfig({
  input: {
    npk: './src/mod.ts',
  },
  plugins: [
    ts({
      typescript,
      tsconfig: 'tsconfig.main.json',
      cacheDir: 'target/.rts_cache',
    }),
  ],
  external(id) {
    return id.startsWith('node:') || externals.has(id);
  },
  output: [
    {
      format: 'cjs',
      sourcemap: true,
      dir: '.',
      exports: 'auto',
      entryFileNames: 'dist/[name].cjs',
      chunkFileNames: 'dist/_[name].cjs',
      hoistTransitiveImports: false,
    },
    {
      format: 'esm',
      sourcemap: true,
      dir: '.',
      entryFileNames: 'dist/[name].js',
      chunkFileNames: 'dist/_[name].js',
      hoistTransitiveImports: false,
      plugins: [
        flatDts({
          tsconfig: 'tsconfig.main.json',
          lib: true,
          file: './dist/npk.d.ts',
          compilerOptions: {
            declarationMap: true,
          },
          internal: ['**/impl/**', '**/*.impl.ts'],
        }),
      ],
    },
  ],
});
