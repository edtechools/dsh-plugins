import Schema from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/namespace.ts
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
const TURN_NAV_NAMESPACE = "dsh-plugin-turn-nav";
/**
* Applied when no settings provider is composed, matching the schema defaults.
* Both switches start on: the rail is the plugin's product, and its switch is
* how a first-time user discovers there is anything to turn off.
*/
const DEFAULT_CONFIG = {
	visible: true,
	sidebarToggle: true,
	markLabelChars: 12
};
/** Accepted range for the label length, shared by the schema and the card. */
const MARK_LABEL_CHARS = {
	min: 4,
	max: 60
};
/**
* Lengths the card offers. A discrete set rather than a free number field, so
* the control writes a complete value on every change and the card can keep
* applying immediately — a typed number would pass through values the user
* never chose (7 on the way to 16). A hand-edited section may hold any value
* in range, and the card adds it to this list rather than losing it.
*/
const MARK_LABEL_PRESETS = [
	6,
	8,
	12,
	16,
	24,
	40
];
//#endregion
//#region src/index.ts
const NS = settingsNamespace(TURN_NAV_NAMESPACE);
const Config = Schema.object({
	visible: Schema.boolean().default(DEFAULT_CONFIG.visible).description("Show the turn navigation rail at the conversation's left edge."),
	sidebarToggle: Schema.boolean().default(DEFAULT_CONFIG.sidebarToggle).description("Show the rail's quick switch in the sidebar footer. Turning it off leaves the settings card as the only way back."),
	markLabelChars: Schema.number().min(MARK_LABEL_CHARS.min).max(MARK_LABEL_CHARS.max).default(DEFAULT_CONFIG.markLabelChars).description("Characters of a marked turn's title shown beside its line. The gutter between rail and transcript also caps the label, so a wide value has no effect in a narrow window.")
});
/**
* Register the configuration. Every field is read by the browser half through
* the settings scope, so the Host derives nothing from it and needs no
* `onChange` work — unlike a plugin whose registrations bake a value in.
* @param ctx - Host context that may acquire the settings service.
* @param config - this plugin's cordis.yml entry, used as the composition base.
*/
function apply(ctx, config) {
	installSettingsSection(ctx, NS, Config, config, {
		setSource: () => {},
		onChange: () => {}
	});
}
//#endregion
export { Config, DEFAULT_CONFIG, MARK_LABEL_CHARS, MARK_LABEL_PRESETS, TURN_NAV_NAMESPACE, apply };
