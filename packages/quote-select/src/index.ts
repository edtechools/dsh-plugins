/**
 * Quote-selection plugin, node half. The surface itself is entirely in the
 * browser half (shipped via exports["./client"], discovered through the
 * package.json dsh.client declaration); what the Host owns is the limits the
 * browser enforces.
 *
 * Registering the namespace here is what makes those limits editable rather
 * than compiled in, and what makes the browser card's `settings.plugin.item`
 * seat resolvable — the tab pairs a card with a namespace and never learns
 * what either means.
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { QUOTE_SELECT_NAMESPACE } from './namespace.ts'
import { QuoteSelectSettingsSchema } from './settings.ts'

export {
  QUOTE_SELECT_NAMESPACE, DEFAULT_SETTINGS, LIMITS, type QuoteSelectSettings,
} from './namespace.ts'
export { QuoteSelectSettingsSchema } from './settings.ts'

/**
 * Register this plugin's limits when a settings provider is composed. Optional
 * injection: a composition without settings still quotes, at the schema
 * defaults.
 * @param ctx - Host context that may acquire the settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(settingsNamespace(QUOTE_SELECT_NAMESPACE), QuoteSelectSettingsSchema)
  })
}
