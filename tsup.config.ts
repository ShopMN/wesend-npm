import { defineConfig } from 'tsup'
import { version } from './package.json'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'node20',
  dts: true,
  clean: true,
  define: { __VERSION__: JSON.stringify(version) },
})
