/**
 * Self-contained build for both halves of this plugin. Deliberately duplicates
 * the harness's own client-bundle settings instead of importing them: `prepare`
 * runs after a git install, where no sibling harness checkout exists.
 *
 * The browser half is not a plain module. The harness shell owns a frozen
 * module table and hands each plugin bundle a `require` that answers only the
 * platform specifiers below; the bundle registers itself as a closure factory
 * through `window.__ModuleLoader__.load`. Three consequences, all load-bearing:
 *
 * - `react` MUST stay external. Bundling it would ship a second React instance
 *   whose hooks cannot see the shell's dispatcher.
 * - Everything not in the table MUST be inlined, because the injected `require`
 *   cannot answer it.
 * - `BUNDLE_ID` must equal this package's name: the node half serves the
 *   artifact at `/plugins/<package name>/client.js`, and the loader matches the
 *   handoff by that id.
 *
 * The node half's own dependencies stay external and resolve at runtime through
 * the profile's flat module fallback, which keeps one shared copy of each
 * Service Definition.
 */
import type { UserConfig } from 'tsdown'

/** Package name; also the module-table id the shell registers this bundle under. */
const BUNDLE_ID = 'dsh-plugin-web-search'

/**
 * Specifiers the shell shares into its frozen module table, mirroring
 * `PLATFORM_MODULES` in the harness's `dsh-client-web`. Anything absent here is
 * inlined instead — a `require` the table cannot answer throws at boot.
 */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-attachment',
  '@deepseek-ai/dsh-client-schema-form',
]

/** Node half: the host Loader imports this as an ordinary ESM plugin module. */
const nodeHalf: UserConfig = {
  name: BUNDLE_ID,
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

/** Browser half: closure-factory artifact fetched outside the shell's module graph. */
const browserHalf: UserConfig = {
  name: `${BUNDLE_ID}/client`,
  entry: { client: 'src/client/index.tsx' },
  outDir: 'lib',
  format: 'cjs',
  platform: 'browser',
  dts: false,
  sourcemap: true,
  clean: false,
  external: PLATFORM_MODULES,
  noExternal: (id: string) => (PLATFORM_MODULES.includes(id) ? undefined : true),
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  outputOptions: {
    entryFileNames: 'client.js',
    banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(BUNDLE_ID)}, factory: (require) => {`,
    footer: 'return module.exports; } });',
    intro: 'var module = { exports: {} }; var exports = module.exports;',
  },
}

export default [nodeHalf, browserHalf]
