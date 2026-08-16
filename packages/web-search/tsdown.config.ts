/**
 * Self-contained build. Node half only — this plugin has no browser surface,
 * so its manifest carries no `dsh.client` declaration. Dependencies and peer
 * dependencies stay external and resolve at runtime through the profile's flat
 * module fallback, which keeps one shared copy of each Service Definition.
 */
import type { UserConfig } from 'tsdown'

export default {
  name: 'dsh-plugin-web-search',
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
} satisfies UserConfig
