/**
 * Quote-selection plugin, node half. The surface is entirely in the browser
 * half (shipped via exports["./client"], discovered through the package.json
 * dsh.client declaration); what the Host owns is the plugin's configuration.
 *
 * ONE configuration, two layers. `Config` is both the cordis.yml schema and the
 * settings namespace's schema: `installSettingsSection` — the harness's own
 * wiring, used by `llm-deepseek` and `agent-loop` — registers the namespace
 * with this plugin's composition entry as the `base`, so the chain is schema
 * default → cordis.yml → the user's settings document. A deployment can set the
 * limits from cordis.yml; the card edits the layer above them.
 *
 * Registering the namespace is also what makes the browser card's
 * `settings.plugin.item` seat resolvable — the tab pairs a card with a
 * namespace and never learns what either means.
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { DEFAULT_CONFIG, LIMITS, QUOTE_SELECT_NAMESPACE, type QuoteSelectConfig } from './namespace.ts'

export {
  QUOTE_SELECT_NAMESPACE, DEFAULT_CONFIG, LIMITS, type QuoteSelectConfig,
} from './namespace.ts'

/** The cordis.yml config, which is also the settings namespace's section. */
export type Config = QuoteSelectConfig

const NS = settingsNamespace(QUOTE_SELECT_NAMESPACE)

export const Config: Schema<Config> = Schema.object({
  maxQuoteLength: Schema.number()
    .min(LIMITS.maxQuoteLength.min).max(LIMITS.maxQuoteLength.max)
    .default(DEFAULT_CONFIG.maxQuoteLength)
    .description('Longest quoted passage kept, in characters. A longer selection is cut with an ellipsis.'),
  maxCommentLength: Schema.number()
    .min(LIMITS.maxCommentLength.min).max(LIMITS.maxCommentLength.max)
    .default(DEFAULT_CONFIG.maxCommentLength)
    .description('Longest comment kept, in characters.'),
  maxQuotes: Schema.number()
    .min(LIMITS.maxQuotes.min).max(LIMITS.maxQuotes.max)
    .default(DEFAULT_CONFIG.maxQuotes)
    .description('Quotes one message may carry. Past this the selection pill refuses rather than dropping one silently.'),
})

/**
 * Register the configuration. Every field is read by the browser half through
 * the settings scope, so the Host derives nothing from it and needs no
 * `onChange` work — unlike a plugin whose registrations bake a value in.
 * @param ctx - Host context that may acquire the settings service.
 * @param config - this plugin's cordis.yml entry, used as the composition base.
 */
export function apply(ctx: Context, config: Config): void {
  installSettingsSection(ctx, NS, Config, config, {
    setSource: () => {},
    onChange: () => {},
  })
}
