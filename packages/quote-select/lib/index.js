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
* the values it actually needs.
*/
/**
* Settings namespace. Equal to the package name so the settings document, the
* served client bundle, and the plugin row all read as one thing — and so the
* card's slot key needs no registry of its own.
*/
const QUOTE_SELECT_NAMESPACE = "dsh-plugin-quote-select";
/** Applied when no settings provider is composed, matching the schema defaults. */
const DEFAULT_CONFIG = {
	maxQuoteLength: 600,
	maxCommentLength: 200,
	maxQuotes: 8
};
/**
* Accepted ranges, shared by the schema and the card's number inputs so the
* control cannot offer a value the Host would reject.
*/
const LIMITS = {
	maxQuoteLength: {
		min: 50,
		max: 4e3
	},
	maxCommentLength: {
		min: 20,
		max: 1e3
	},
	maxQuotes: {
		min: 1,
		max: 32
	}
};
//#endregion
//#region src/index.ts
const NS = settingsNamespace(QUOTE_SELECT_NAMESPACE);
const Config = Schema.object({
	maxQuoteLength: Schema.number().min(LIMITS.maxQuoteLength.min).max(LIMITS.maxQuoteLength.max).default(DEFAULT_CONFIG.maxQuoteLength).description("Longest quoted passage kept, in characters. A longer selection is cut with an ellipsis."),
	maxCommentLength: Schema.number().min(LIMITS.maxCommentLength.min).max(LIMITS.maxCommentLength.max).default(DEFAULT_CONFIG.maxCommentLength).description("Longest comment kept, in characters."),
	maxQuotes: Schema.number().min(LIMITS.maxQuotes.min).max(LIMITS.maxQuotes.max).default(DEFAULT_CONFIG.maxQuotes).description("Quotes one message may carry. Past this the selection pill refuses rather than dropping one silently.")
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
export { Config, DEFAULT_CONFIG, LIMITS, QUOTE_SELECT_NAMESPACE, apply };
