/**
 * Web search tool over the Bocha search API.
 *
 * Every deployment-varying value is a validated `Config` field rather than a
 * constant, and the API key is held as a credential *reference* — the
 * configuration names `BOCHA_API_KEY`, the value lives with the credential
 * provider, so no config file or patch layer ever carries the secret.
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { credentialRef } from '@deepseek-ai/dsh-credentials'

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
  const ref = credentialRef(config.apiKeyRef)

  ctx.tools.register(defineTool({
    name: 'web-search',
    description: 'Search the web for information.',
    parameters: {
      query: { type: 'string', required: true, description: 'The search query' },
      count: { type: 'number', description: `Number of results (default ${config.defaultCount})` },
      summary: { type: 'boolean', description: `Include summary (default ${config.defaultSummary})` },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    timeoutMs: config.timeoutMs,
    async execute(args, exec) {
      // Resolved per call, never cached: a rotated key reaches the very next
      // search without restarting the plugin.
      const hit = await ctx.credentials.resolve(ref)
      if (!hit) {
        throw new Error(
          `web-search: credential ${config.apiKeyRef} is not configured — `
          + `store it with the credential provider (for example in $DSH_HOME/.credentials.yaml)`,
        )
      }

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${hit.value}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: args.query,
          count: args.count ?? config.defaultCount,
          summary: args.summary ?? config.defaultSummary,
        }),
        signal: exec.signal,
      })

      if (!response.ok) {
        // The status line alone rarely says why; the body carries the provider's reason.
        const body = await response.text().catch(() => '')
        const detail = body === '' ? '' : ` — ${body.slice(0, ERROR_BODY_LIMIT)}`
        throw new Error(`web-search: ${response.status} ${response.statusText}${detail}`)
      }
      return await response.json()
    },
  }))
}
