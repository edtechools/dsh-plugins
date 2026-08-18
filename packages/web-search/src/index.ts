/**
 * `bocha_web_search` tool over the Bocha (博查) search API.
 *
 * Every deployment-varying value is a validated `Config` field rather than a
 * constant, and cordis.yml supplies those as the settings namespace's
 * composition `base`, so the settings card edits a layer above the deployment's
 * own configuration rather than replacing it.
 *
 * Two ways to supply the key, checked in this order: a literal stored in the
 * section's `role('secret')` field (what the card writes — the seam keeps it
 * out of every response, so it can be set but never read back), and otherwise
 * the credential *reference* the section names, whose value lives with the
 * credential provider. A deployment that keeps secrets out of the settings
 * document simply never sets the first.
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { WEB_SEARCH_NAMESPACE, type WebSearchSettings } from './namespace.ts'
import { WebSearchSettingsSchema } from './settings.ts'

export {
  WEB_SEARCH_NAMESPACE, COUNT_RANGE, DEFAULT_SETTINGS, type WebSearchSettings,
} from './namespace.ts'
export { WebSearchSettingsSchema } from './settings.ts'

export const name = 'web-search-tool'
export const inject = ['tools', 'credentials']

/** Longest error body echoed into a tool failure, keeping a huge page out of the transcript. */
const ERROR_BODY_LIMIT = 500

export interface Config {
  endpoint: string
  apiKeyRef: string
  defaultCount: number
  defaultSummary: boolean
  timeoutMs: number
}

export const Config: Schema<Config> = Schema.object({
  endpoint: Schema.string().default('https://api.bocha.cn/v1/web-search')
    .description('Search API endpoint.'),
  apiKeyRef: Schema.string().default('BOCHA_API_KEY')
    .description('Credential reference holding the API key; the value never appears in configuration.'),
  defaultCount: Schema.number().min(1).max(50).default(10)
    .description('Result count used when the model omits `count`.'),
  defaultSummary: Schema.boolean().default(true)
    .description('Summary flag used when the model omits `summary`.'),
  timeoutMs: Schema.number().min(1000).default(30000)
    .description('Cooperative timeout budget for one search.'),
})

export function apply(ctx: Context, config: Config): void {
  /**
   * The live configuration. Starts at the cordis.yml `Config` and is replaced
   * by the settings section once a settings provider composes — a deployment
   * without one keeps working, unconfigurable but correct.
   */
  let read = (): WebSearchSettings => config

  ctx.inject(['settings'], (settingsCtx) => {
    // cordis.yml becomes the composition base, so an untouched field still
    // reads from the deployment's own configuration and clearing a field in
    // the card returns it there rather than to the schema default.
    const scope = settingsCtx.settings.register(
      settingsNamespace(WEB_SEARCH_NAMESPACE),
      WebSearchSettingsSchema,
      {
        base: {
          endpoint: config.endpoint,
          apiKeyRef: config.apiKeyRef,
          defaultCount: config.defaultCount,
          defaultSummary: config.defaultSummary,
        },
      },
    )
    settingsCtx.effect(() => {
      read = () => scope.get()
      return () => {
        read = () => config
      }
    }, 'web-search: settings-backed configuration')
  })

  ctx.tools.register(defineTool({
    // Named for its source, not for the capability: the harness's own web
    // capability already registers `web_search`, and two tools whose names
    // differ only by a separator give the model nothing to choose between.
    name: 'bocha_web_search',
    description: 'Search the web through the Bocha (博查) search API. Strongest on Chinese-language queries and sources from mainland China.',
    parameters: {
      query: { type: 'string', required: true, description: 'The search query' },
      // Deliberately the cordis.yml values, not the live ones: a tool's
      // parameter descriptions are part of the schema the model is shown, and
      // that schema is built once at registration. Quoting a number that can
      // drift would make the description a lie rather than a default.
      count: { type: 'number', description: `Number of results (default ${config.defaultCount})` },
      summary: { type: 'boolean', description: `Include summary (default ${config.defaultSummary})` },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    timeoutMs: config.timeoutMs,
    async execute(args, exec) {
      // Resolved per call, never cached: a rotated key — or a reference the
      // user just renamed in the settings card — reaches the very next search
      // without restarting the plugin.
      const settings = read()
      // A key stored in the section wins over the reference: the user typed it
      // into this plugin's own card, which is a more specific statement than
      // the reference the deployment configured. Both paths stay open — the
      // reference is what a deployment that keeps secrets out of the settings
      // document uses, and it is what remains when the stored key is cleared.
      const key = settings.apiKey !== undefined && settings.apiKey !== ''
        ? settings.apiKey
        : (await ctx.credentials.resolve(credentialRef(settings.apiKeyRef)))?.value
      if (key === undefined || key === '') {
        throw new Error(
          `web-search: no API key — paste one into the plugin's settings card, `
          + `or store credential ${settings.apiKeyRef} with the credential provider `
          + `(for example in $DSH_HOME/.credentials.yaml)`,
        )
      }

      const response = await fetch(settings.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: args.query,
          count: args.count ?? settings.defaultCount,
          summary: args.summary ?? settings.defaultSummary,
        }),
        signal: exec.signal,
      })

      if (!response.ok) {
        // The status line alone rarely says why; the body carries the provider's reason.
        const body = await response.text().catch(() => '')
        const detail = body === '' ? '' : ` — ${body.slice(0, ERROR_BODY_LIMIT)}`
        throw new Error(`web-search: ${response.status} ${response.statusText}${detail}`)
      }

      // Wire boundary: the declared output schema promises the model a JSON
      // object, and a 200 from someone else's API is not evidence of one. The
      // cast that follows the check is sound because the value came from
      // JSON.parse — every member is a JsonValue by construction, which is the
      // part a runtime check could only re-derive at the cost of a deep walk.
      const payload: unknown = await response.json()
      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error(`web-search: ${settings.endpoint} answered with ${payload === null ? 'null' : typeof payload}, expected a JSON object`)
      }
      return payload as Record<string, JsonValue>
    },
  }))
}
