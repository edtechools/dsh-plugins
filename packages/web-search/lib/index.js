import Schema from "@deepseek-ai/schemastery";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";
//#region src/namespace.ts
/**
* The plugin's configuration type and settings identity, kept free of runtime
* imports so both halves can take them.
*
* There is exactly ONE configuration type. `Config` is the cordis.yml schema
* AND the settings namespace's schema: `installSettingsSection` registers the
* namespace with the plugin's composition entry as the `base` layer, so the
* resolution chain is schema default → cordis.yml → the user's settings
* document, with no parallel type to keep in step.
*
* The schema itself lives in index.ts because it needs schemastery, which is
* absent from the shell's frozen module table and would be inlined into the
* client bundle for a constant. Types erase, so the browser half takes this
* file and nothing else.
*/
/**
* Settings namespace. Equal to the package name so the settings document, the
* served client bundle, and the plugin row all read as one thing — and so the
* card's slot key needs no registry of its own.
*/
const WEB_SEARCH_NAMESPACE = "dsh-plugin-web-search";
/** Applied when neither a stored section nor a composition base supplies one. */
const DEFAULT_CONFIG = {
	endpoint: "https://api.bocha.cn/v1/web-search",
	apiKeyRef: "BOCHA_API_KEY",
	defaultCount: 10,
	defaultSummary: true,
	timeoutMs: 3e4
};
/** Accepted ranges, shared by the schema and the card's inputs. */
const RANGES = {
	defaultCount: {
		min: 1,
		max: 50
	},
	timeoutMs: {
		min: 1e3,
		max: 3e5
	}
};
//#endregion
//#region src/index.ts
const name = "web-search-tool";
const inject = ["tools", "credentials"];
/** Longest error body echoed into a tool failure, keeping a huge page out of the transcript. */
const ERROR_BODY_LIMIT = 500;
const NS = settingsNamespace(WEB_SEARCH_NAMESPACE);
const Config = Schema.object({
	endpoint: Schema.string().default(DEFAULT_CONFIG.endpoint).description("Search API endpoint."),
	apiKeyRef: Schema.string().role("credential-ref").default(DEFAULT_CONFIG.apiKeyRef).description("Credential reference naming this plugin's API key; the value lives with the credential provider and the card writes it through credentials.set."),
	defaultCount: Schema.number().min(RANGES.defaultCount.min).max(RANGES.defaultCount.max).default(DEFAULT_CONFIG.defaultCount).description("Result count used when the model omits `count`."),
	defaultSummary: Schema.boolean().default(DEFAULT_CONFIG.defaultSummary).description("Summary flag used when the model omits `summary`."),
	timeoutMs: Schema.number().min(RANGES.timeoutMs.min).max(RANGES.timeoutMs.max).default(DEFAULT_CONFIG.timeoutMs).description("Cooperative timeout budget for one search.")
});
/** Whether two fact sets agree, so an unrelated change costs no re-registration. */
function sameFacts(a, b) {
	return a.timeoutMs === b.timeoutMs && a.defaultCount === b.defaultCount && a.defaultSummary === b.defaultSummary;
}
function apply(ctx, config) {
	/** Currently authoritative configuration; swapped by installSettingsSection. */
	let current = () => config;
	let facts;
	let disposeTool;
	/**
	* Register the tool, replacing an existing registration when a fact it baked
	* in has changed. Idempotent for every other change, so editing the endpoint
	* or the key does not disturb a conversation mid-turn.
	*/
	const ensureRegistrationFacts = () => {
		const live = current();
		const next = {
			timeoutMs: live.timeoutMs,
			defaultCount: live.defaultCount,
			defaultSummary: live.defaultSummary
		};
		if (facts !== void 0 && sameFacts(facts, next)) return;
		disposeTool?.();
		facts = next;
		disposeTool = ctx.tools.register(defineTool({
			name: "bocha_web_search",
			description: "Search the web through the Bocha (博查) search API. Strongest on Chinese-language queries and sources from mainland China.",
			parameters: {
				query: {
					type: "string",
					required: true,
					description: "The search query"
				},
				count: {
					type: "number",
					description: `Number of results (default ${next.defaultCount})`
				},
				summary: {
					type: "boolean",
					description: `Include summary (default ${next.defaultSummary})`
				}
			},
			output: {
				schema: {
					type: "object",
					additionalProperties: true
				},
				render: (_args, value) => [{
					type: "text",
					text: JSON.stringify(value, null, 2)
				}]
			},
			timeoutMs: next.timeoutMs,
			async execute(args, exec) {
				const settings = current();
				const key = (await ctx.credentials.resolve(credentialRef(settings.apiKeyRef)))?.value;
				if (key === void 0 || key === "") throw new Error(`web-search: credential ${settings.apiKeyRef} is not configured — store it from the plugin's settings card, or in $DSH_HOME/.credentials.yaml`);
				const response = await fetch(settings.endpoint, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${key}`,
						"Content-Type": "application/json"
					},
					body: JSON.stringify({
						query: args.query,
						count: args.count ?? settings.defaultCount,
						summary: args.summary ?? settings.defaultSummary
					}),
					signal: exec.signal
				});
				if (!response.ok) {
					const body = await response.text().catch(() => "");
					const detail = body === "" ? "" : ` — ${body.slice(0, ERROR_BODY_LIMIT)}`;
					throw new Error(`web-search: ${response.status} ${response.statusText}${detail}`);
				}
				const payload = await response.json();
				if (payload === null || typeof payload !== "object" || Array.isArray(payload)) throw new Error(`web-search: ${settings.endpoint} answered with ${payload === null ? "null" : typeof payload}, expected a JSON object`);
				return payload;
			}
		}));
	};
	ctx.effect(() => () => {
		disposeTool?.();
	}, "web-search: tool");
	ensureRegistrationFacts();
	installSettingsSection(ctx, NS, Config, config, {
		setSource: (source) => {
			current = source;
		},
		onChange: ensureRegistrationFacts
	});
}
//#endregion
export { Config, DEFAULT_CONFIG, RANGES, WEB_SEARCH_NAMESPACE, apply, inject, name };
