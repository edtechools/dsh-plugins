/**
 * The Host-side schema for the rail's durable preferences. Kept apart from
 * namespace.ts so the browser half can take the identity without taking
 * schemastery with it.
 */

import Schema from '@deepseek-ai/schemastery'
import { DEFAULT_SETTINGS, MARK_LABEL_CHARS, type TurnNavSettings } from './namespace.ts'

export const TurnNavSettingsSchema: Schema<TurnNavSettings> = Schema.object({
  visible: Schema.boolean().default(DEFAULT_SETTINGS.visible)
    .description('Show the turn navigation rail at the conversation\'s left edge.'),
  sidebarToggle: Schema.boolean().default(DEFAULT_SETTINGS.sidebarToggle)
    .description('Show the rail\'s quick switch in the sidebar footer. Turning it off leaves this card as the only way back.'),
  markLabelChars: Schema.number()
    .min(MARK_LABEL_CHARS.min).max(MARK_LABEL_CHARS.max)
    .default(DEFAULT_SETTINGS.markLabelChars)
    .description('Characters of a marked turn\'s title shown beside its line. The gutter between rail and transcript also caps the label, so a wide value has no effect in a narrow window.'),
})
