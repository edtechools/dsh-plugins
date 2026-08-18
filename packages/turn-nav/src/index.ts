/**
 * Turn navigation rail plugin, node half. The surface itself is entirely in the
 * browser half (shipped via exports["./client"], discovered through the
 * package.json dsh.client declaration); what the Host owns is the rail's
 * durable preference.
 *
 * Registering the namespace here is what puts the rail's visibility in the
 * user's settings document rather than in browser-local storage, and what makes
 * the browser card's `settings.plugin.item` seat resolvable — the tab pairs a
 * card with a namespace and never learns what either means.
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import { TURN_NAV_NAMESPACE } from './namespace.ts'
import { TurnNavSettingsSchema } from './settings.ts'

export { TURN_NAV_NAMESPACE, DEFAULT_SETTINGS, type TurnNavSettings } from './namespace.ts'
export { TurnNavSettingsSchema } from './settings.ts'

/**
 * Register the rail's durable preference when a settings provider is composed.
 * Optional injection, following the harness's own preference-owning UI plugins:
 * a composition without settings still serves the rail, which then falls back
 * to the schema default.
 * @param ctx - Host context that may acquire the settings service.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(settingsNamespace(TURN_NAV_NAMESPACE), TurnNavSettingsSchema)
  })
}
