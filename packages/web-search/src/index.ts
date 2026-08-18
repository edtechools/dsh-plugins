/**
 * `bocha_web_search` tool over the Bocha (博查) search API.
 *
 * ONE configuration, two layers. `Config` is both the cordis.yml schema and the
 * settings namespace's schema: `installSettingsSection` — the harness's own
 * wiring for this, used by `llm-deepseek` and `agent-loop` — registers the
 * namespace with this plugin's composition entry as the `base`, so the chain is
 * schema default → cordis.yml → the user's settings document, and a deployment
 * with no settings provider keeps running exactly as composed.
 *
 * The API key is NOT one of those fields. The section names a credential
 * *reference*; the value lives in the credential plane, and the settings card
 * writes it there through `credentials.set` — the same split the shipped model
 * cards use, and the reason `llm-deepseek` declares only `apiKeyEnv`. Keeping
 * it out of the settings document is what keeps it out of a 644 file the user
 * opens in a text editor.
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool, type JsonValue } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { DEFAULT_CONFIG, RANGES, WEB_SEARCH_NAMESPACE, type WebSearchConfig } from './namespace.ts'

export { WEB_SEARCH_NAMESPACE, DEFAULT_CONFIG, RANGES, type WebSearchConfig } from './namespace.ts'

/**
 * The cordis.yml config, which is also the settings namespace's section. A
 * type alias rather than a re-export so it can merge with the schema constant
 * of the same name below — the field list itself lives in namespace.ts, where
 * the browser half can read it without pulling schemastery in.
 */
export type Config = WebSearchConfig

export const name = 'web-search-tool'
export const inject = ['tools', 'credentials']

/** Longest error body echoed into a tool failure, keeping a huge page out of the transcript. */
const ERROR_BODY_LIMIT = 500

const NS = settingsNamespace(WEB_SEARCH_NAMESPACE)

export const Config: Schema<Config> = Schema.object({
  endpoint: Schema.string().default(DEFAULT_CONFIG.endpoint)
    .description('Search API endpoint.'),
  apiKeyRef: Schema.string().role('credential-ref').default(DEFAULT_CONFIG.apiKeyRef)
    .description('Credential reference naming this plugin\'s API key; the value lives with the credential provider and the card writes it through credentials.set.'),
  defaultCount: Schema.number()
    .min(RANGES.defaultCount.min).max(RANGES.defaultCount.max).default(DEFAULT_CONFIG.defaultCount)
    .description('Result count used when the model omits `count`.'),
  defaultSummary: Schema.boolean().default(DEFAULT_CONFIG.defaultSummary)
    .description('Summary flag used when the model omits `summary`.'),
  timeoutMs: Schema.number()
    .min(RANGES.timeoutMs.min).max(RANGES.timeoutMs.max).default(DEFAULT_CONFIG.timeoutMs)
    .description('Cooperative timeout budget for one search.'),
})

/**
 * The configuration facts a tool registration bakes in, as opposed to the ones
 * `execute` reads per call. `timeoutMs` is copied into the definition by
 * `defineTool`, and the two defaults are quoted in parameter descriptions —
 * part of the schema shown to the model, built once. A change to any of them is
 * therefore a new registration, not a new read.
 */
interface RegistrationFacts {
  timeoutMs: number
  defaultCount: number
  defaultSummary: boolean
}

/** Whether two fact sets agree, so an unrelated change costs no re-registration. */
function sameFacts(a: RegistrationFacts, b: RegistrationFacts): boolean {
  return a.timeoutMs === b.timeoutMs
    && a.defaultCount === b.defaultCount
    && a.defaultSummary === b.defaultSummary
}

export function apply(ctx: Context, config: Config): void {
  /** Currently authoritative configuration; swapped by installSettingsSection. */
  let current = (): Config => config

  let facts: RegistrationFacts | undefined
  let disposeTool: (() => void) | undefined

  /**
   * Register the tool, replacing an existing registration when a fact it baked
   * in has changed. Idempotent for every other change, so editing the endpoint
   * or the key does not disturb a conversation mid-turn.
   */
  const ensureRegistrationFacts = (): void => {
    const live = current()
    const next: RegistrationFacts = {
      timeoutMs: live.timeoutMs,
      defaultCount: live.defaultCount,
      defaultSummary: live.defaultSummary,
    }
    if (facts !== undefined && sameFacts(facts, next)) return
    disposeTool?.()
    facts = next
    disposeTool = ctx.tools.register(defineTool({
      // Named for its source, not for the capability: the harness's own web
      // capability already registers `web_search`, and two tools whose names
      // differ only by a separator give the model nothing to choose between.
      name: 'bocha_web_search',
      description: 'Search the web through the Bocha (博查) search API. Strongest on Chinese-language queries and sources from mainland China.',
      parameters: {
        query: { type: 'string', required: true, description: 'The search query' },
        count: { type: 'number', description: `Number of results (default ${next.defaultCount})` },
        summary: { type: 'boolean', description: `Include summary (default ${next.defaultSummary})` },
      },
      output: {
        schema: { type: 'object', additionalProperties: true },
        render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
      },
      timeoutMs: next.timeoutMs,
      async execute(args, exec) {
        // Read per call, never captured: an endpoint or key edited in the
        // settings card reaches the very next search.
        const settings = current()
        // The key is never a settings field: the section names a reference and
        // the credential plane holds the value, which is where the settings
        // card writes it too. Resolved per call, so a rotated key — or one the
        // card just stored — reaches the very next search.
        const key = (await ctx.credentials.resolve(credentialRef(settings.apiKeyRef)))?.value
        if (key === undefined || key === '') {
          throw new Error(
            `web-search: credential ${settings.apiKeyRef} is not configured — `
            + `store it from the plugin's settings card, or in $DSH_HOME/.credentials.yaml`,
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
        // JSON.parse — every member is a JsonValue by construction, which is
        // the part a runtime check could only re-derive by a deep walk.
        const payload: unknown = await response.json()
        if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error(`web-search: ${settings.endpoint} answered with ${payload === null ? 'null' : typeof payload}, expected a JSON object`)
        }
        return payload as Record<string, JsonValue>
      },
    }))
  }

  ctx.effect(() => () => {
    disposeTool?.()
  }, 'web-search: tool')

  // Registered before the settings wiring, so a composition with no settings
  // provider — where the injection inside the helper never fires — still gets
  // the tool.
  ensureRegistrationFacts()

  installSettingsSection(ctx, NS, Config, config, {
    setSource: (source) => {
      current = source
    },
    onChange: ensureRegistrationFacts,
  })
}
