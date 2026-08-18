/**
 * The settings identity both halves share, kept free of runtime imports.
 *
 * The Host half pairs this with a schemastery schema (settings.ts); the browser
 * half must NOT reach that file, because schemastery is absent from the shell's
 * frozen module table and would therefore be inlined into the client bundle for
 * a constant. Splitting the identity out is what keeps the browser bundle to
 * the string it actually needs.
 */

/**
 * Settings namespace. Equal to the package name so the settings document, the
 * served client bundle, and the plugin row all read as one thing — and so the
 * card's slot key needs no registry of its own: the configurable-plugins tab
 * pairs a card with a namespace by this key alone.
 */
export const TURN_NAV_NAMESPACE = 'dsh-plugin-turn-nav'

/** The rail's durable preference section. */
export interface TurnNavSettings {
  /** Whether the rail itself is drawn. */
  visible: boolean
  /** Whether the sidebar foot carries the rail's quick switch. */
  sidebarToggle: boolean
  /**
   * Characters of a marked turn's title shown beside its line. A label names a
   * turn well enough to find it again; it is not the message.
   */
  markLabelChars: number
}

/**
 * Applied when no settings provider is composed, matching the schema defaults.
 * Both switches start on: the rail is the plugin's product, and its switch is
 * how a first-time user discovers there is anything to turn off.
 */
export const DEFAULT_SETTINGS: TurnNavSettings = {
  visible: true,
  sidebarToggle: true,
  markLabelChars: 12,
}

/** Accepted range for the label length, shared by the schema and the card. */
export const MARK_LABEL_CHARS = { min: 4, max: 60 } as const

/**
 * Lengths the card offers. A discrete set rather than a free number field, so
 * the control writes a complete value on every change and the card can keep
 * applying immediately — a typed number would pass through values the user
 * never chose (7 on the way to 16). A hand-edited section may hold any value
 * in range, and the card adds it to this list rather than losing it.
 */
export const MARK_LABEL_PRESETS = [6, 8, 12, 16, 24, 40] as const
