/**
 * Turn navigation rail plugin, node half. The surface is entirely in the
 * browser half (shipped via exports["./client"], discovered through the
 * package.json dsh.client declaration); what the Host owns is the plugin's
 * configuration.
 *
 * ONE configuration, two layers. `Config` is both the cordis.yml schema and the
 * settings namespace's schema: `installSettingsSection` — the harness's own
 * wiring, used by `llm-deepseek` and `agent-loop` — registers the namespace
 * with this plugin's composition entry as the `base`, so the chain is schema
 * default → cordis.yml → the user's settings document. A deployment can preset
 * the rail from cordis.yml; the card edits the layer above it.
 *
 * Registering the namespace is also what makes the browser card's
 * `settings.plugin.item` seat resolvable — the tab pairs a card with a
 * namespace and never learns what either means.
 */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { DEFAULT_CONFIG, MARK_LABEL_CHARS, TURN_NAV_NAMESPACE, type TurnNavConfig } from './namespace.ts'

export {
  TURN_NAV_NAMESPACE, DEFAULT_CONFIG, MARK_LABEL_CHARS, MARK_LABEL_PRESETS, type TurnNavConfig,
} from './namespace.ts'

/** The cordis.yml config, which is also the settings namespace's section. */
export type Config = TurnNavConfig

const NS = settingsNamespace(TURN_NAV_NAMESPACE)

export const Config: Schema<Config> = Schema.object({
  visible: Schema.boolean().default(DEFAULT_CONFIG.visible)
    .description('Show the turn navigation rail at the conversation\'s left edge.'),
  sidebarToggle: Schema.boolean().default(DEFAULT_CONFIG.sidebarToggle)
    .description('Show the rail\'s quick switch in the sidebar footer. Turning it off leaves the settings card as the only way back.'),
  markLabelChars: Schema.number()
    .min(MARK_LABEL_CHARS.min).max(MARK_LABEL_CHARS.max).default(DEFAULT_CONFIG.markLabelChars)
    .description('Characters of a marked turn\'s title shown beside its line. The gutter between rail and transcript also caps the label, so a wide value has no effect in a narrow window.'),
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
