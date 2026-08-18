window.__ModuleLoader__.load({
	id: "dsh-plugin-web-search",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		//#region src/client/settings-store.ts
		/**
		* This plugin's configuration, mirrored locally over the durable settings
		* section.
		*
		* A local mirror rather than reads straight off the scope: the card renders
		* synchronously and the scope's first value arrives asynchronously, so the
		* mirror is what lets the card mount at the defaults and adopt the stored
		* section when it lands.
		*
		* The API key is NOT held in this section. The card addresses it through the
		* credentials domain by the reference the section names — `credentials.set`
		* writes it, `credentials.unset` clears it, and `credentials.describe` reports
		* whether one is configured. So the store reads only booleans about the key,
		* never the literal — exactly the split the shipped model cards' key uses, and
		* the reason `llm-deepseek` declares only `apiKeyEnv`.
		*
		* Deliberately not shared with the sibling plugins that carry a near-identical
		* store: a package here is installable on its own from a repository
		* subdirectory, where a workspace dependency would not resolve.
		*/
		const UNAVAILABLE = {
			phase: "unavailable",
			writable: false
		};
		/**
		* Narrow one field off a wire section, keeping the last good value when the
		* Host does not carry it or carries something else.
		*
		* Version skew is an ORDINARY state here rather than an edge: the browser
		* bundle updates on a page refresh while the Host's registered schema updates
		* only on a restart, so a field this build knows about is routinely missing
		* from the Host that answers it.
		* @param raw - the field as the Host sent it.
		* @param fallback - the value to keep.
		* @returns the field, or the fallback.
		*/
		function pick(raw, fallback) {
			return typeof raw === typeof fallback ? raw : fallback;
		}
		/** Build the store. Starts at the schema defaults and unattached. */
		function createSettingsStore() {
			const listeners = /* @__PURE__ */ new Set();
			let value = { ...DEFAULT_CONFIG };
			let status = UNAVAILABLE;
			let overridden = /* @__PURE__ */ new Set();
			let credential = {
				ref: "",
				configured: void 0,
				writable: void 0,
				source: void 0
			};
			let scope;
			let api;
			const notify = () => {
				for (const listener of listeners) listener();
			};
			/** The credential reference the section currently names. */
			const refOf = () => value.apiKeyRef;
			/**
			* Ask the credentials domain about the reference the section currently names.
			*
			* The answer is stored with the reference it describes: `apiKeyRef` can
			* change between the request and its response, and two reads can settle out
			* of order, so a response is published only while it still answers for the
			* reference in force.
			*/
			const refreshKey = async () => {
				if (api === void 0) return;
				const ref = refOf();
				if (ref !== credential.ref) {
					const wasKnown = credential.configured !== void 0 || credential.writable !== void 0;
					credential = {
						ref,
						configured: void 0,
						writable: void 0,
						source: void 0
					};
					if (wasKnown) notify();
				}
				let response;
				try {
					response = await api.credentials.describe({ refs: [ref] });
				} catch (_credentialReadFailure) {
					return;
				}
				if (response?.result?.ok !== true || ref !== refOf()) return;
				const view = response.result.value.credentials[ref];
				const next = {
					ref,
					configured: view?.configured ?? false,
					writable: view?.writable ?? true,
					source: typeof view?.source === "string" ? view.source : void 0
				};
				if (next.configured === credential.configured && next.writable === credential.writable && next.source === credential.source) return;
				credential = next;
				notify();
			};
			return {
				get: () => value,
				status: () => status,
				overridden: () => overridden,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				save: async (patch) => {
					if (scope === void 0) return;
					for (const [field, next] of Object.entries(patch)) {
						if (next === value[field]) continue;
						await scope.set(field, next);
					}
				},
				reset: async (field) => {
					if (scope === void 0) return;
					await scope.clear(field);
				},
				keyConfigured: () => credential.configured,
				keyWritable: () => credential.writable,
				keySource: () => credential.source,
				refreshKey: () => refreshKey(),
				writeKey: async (next) => {
					if (api === void 0) return;
					const ref = refOf();
					try {
						if (next === "") await api.credentials.unset({ ref });
						else await api.credentials.set({
							ref,
							value: next
						});
					} catch (_credentialWriteFailure) {}
					await refreshKey();
				},
				attach: (bound, boundApi) => {
					scope = bound;
					api = boundApi;
					const sync = () => {
						const snapshot = bound.getSnapshot();
						const section = snapshot.value;
						const nextStatus = {
							phase: snapshot.status,
							writable: snapshot.writable === true && snapshot.status === "ready"
						};
						const nextValue = section === void 0 ? value : {
							endpoint: pick(section.endpoint, value.endpoint),
							apiKeyRef: pick(section.apiKeyRef, value.apiKeyRef),
							defaultCount: pick(section.defaultCount, value.defaultCount),
							defaultSummary: pick(section.defaultSummary, value.defaultSummary),
							timeoutMs: pick(section.timeoutMs, value.timeoutMs)
						};
						const user = snapshot.user;
						const nextOverridden = new Set(user === null || typeof user !== "object" ? [] : Object.keys(user).filter((field) => field in DEFAULT_CONFIG));
						if (Object.keys(DEFAULT_CONFIG).some((field) => nextValue[field] !== value[field]) || nextStatus.phase !== status.phase || nextStatus.writable !== status.writable || nextOverridden.size !== overridden.size || [...nextOverridden].some((field) => !overridden.has(field))) {
							value = nextValue;
							status = nextStatus;
							overridden = nextOverridden;
							notify();
						}
						if (credential.ref !== value.apiKeyRef) refreshKey();
					};
					sync();
					const off = bound.subscribe(sync);
					return () => {
						off();
						scope = void 0;
						api = void 0;
						credential = {
							ref: "",
							configured: void 0,
							writable: void 0,
							source: void 0
						};
						status = UNAVAILABLE;
						notify();
					};
				}
			};
		}
		//#endregion
		//#region src/client/SettingsCard.tsx
		/**
		* This plugin's card in Settings → Plugins.
		*
		* Structure and tokens mirror ui-settings-plugins' `PluginCard` and its field
		* rows so this card and the shipped ones read as one stack; they are copied
		* rather than imported, because the harness hashes its class names per build
		* and its card components sit outside the shell's frozen module table.
		*
		* Edits stage rather than apply per keystroke — these are text and numbers,
		* where writing on every key would store values the user never chose.
		*
		* The API key is editable here but never readable: it never rides a response.
		* It travels through `credentials.set`/`credentials.unset` under the reference
		* the section names, exactly as the shipped model cards' key does
		* (`llm-deepseek` declares only `apiKeyEnv`, never a literal). So it sits
		* outside the staged form — there is nothing committed to diff a draft against
		* — and the card reports only whether `credentials.describe` says one is
		* configured.
		*/
		/** Where a Bocha account issues API keys — the one thing this card cannot supply. */
		const API_KEYS_URL = "https://open.bochaai.com/api-keys";
		const FIELDS = [
			{
				field: "endpoint",
				label: "接口地址",
				hint: "博查搜索 API 的 endpoint。",
				kind: "text"
			},
			{
				field: "apiKeyRef",
				label: "密钥引用名",
				hint: "卡片上方填的密钥以这个名字存进凭据域。",
				kind: "text"
			},
			{
				field: "defaultCount",
				label: "默认结果数",
				hint: `模型没指定 count 时用这个。${RANGES.defaultCount.min}–${RANGES.defaultCount.max}`,
				kind: "number"
			},
			{
				field: "defaultSummary",
				label: "默认返回摘要",
				hint: "模型没指定 summary 时用这个。",
				kind: "boolean"
			},
			{
				field: "timeoutMs",
				label: "单次搜索超时",
				hint: `毫秒。改它会重新注册工具，所以不影响进行中的一轮。${RANGES.timeoutMs.min}–${RANGES.timeoutMs.max}`,
				kind: "number"
			}
		];
		/** Project the committed section into editable form. */
		function draftOf(value) {
			return {
				endpoint: value.endpoint,
				apiKeyRef: value.apiKeyRef,
				defaultCount: String(value.defaultCount),
				defaultSummary: value.defaultSummary,
				timeoutMs: String(value.timeoutMs)
			};
		}
		/**
		* Parse one staged field, or undefined when it cannot be saved — the card
		* offers no value the Host would reject.
		* @param spec - the row being parsed.
		* @param raw - the staged value.
		* @returns the value, or undefined when invalid.
		*/
		function parseField(spec, raw) {
			if (spec.kind === "boolean") return typeof raw === "boolean" ? raw : void 0;
			if (typeof raw !== "string") return void 0;
			if (spec.kind === "text") return raw.trim() === "" ? void 0 : raw.trim();
			if (!/^\d+$/.test(raw.trim())) return void 0;
			const parsed = Number(raw.trim());
			const range = RANGES[spec.field];
			return range !== void 0 && parsed >= range.min && parsed <= range.max ? parsed : void 0;
		}
		/**
		* Render the card.
		* @param props - the store the card reads and writes.
		* @returns the card, or nothing while the namespace is unavailable.
		*/
		function SettingsCard({ store }) {
			const [open, setOpen] = react.useState(false);
			const [value, setValue] = react.useState(store.get);
			const [status, setStatus] = react.useState(store.status);
			const [overridden, setOverridden] = react.useState(store.overridden);
			const [draft, setDraft] = react.useState(() => draftOf(store.get()));
			const [saving, setSaving] = react.useState(false);
			const [failed, setFailed] = react.useState(false);
			const [keyConfigured, setKeyConfigured] = react.useState(store.keyConfigured);
			const [keyWritable, setKeyWritable] = react.useState(store.keyWritable);
			const [keySource, setKeySource] = react.useState(store.keySource);
			const [keyDraft, setKeyDraft] = react.useState("");
			const [keyBusy, setKeyBusy] = react.useState(false);
			const keyId = react.useId();
			const ids = {
				endpoint: react.useId(),
				apiKeyRef: react.useId(),
				defaultCount: react.useId(),
				defaultSummary: react.useId(),
				timeoutMs: react.useId()
			};
			/**
			* Adopt Host values into the staged draft only while nothing is staged: a
			* document edited elsewhere must not overwrite what the user is typing here.
			*/
			const dirtyRef = react.useRef(false);
			react.useEffect(() => store.subscribe(() => {
				const next = store.get();
				setValue(next);
				setStatus(store.status());
				setOverridden(store.overridden());
				setKeyConfigured(store.keyConfigured());
				setKeyWritable(store.keyWritable());
				setKeySource(store.keySource());
				if (!dirtyRef.current) setDraft(draftOf(next));
			}), [store]);
			const parsed = FIELDS.map((spec) => parseField(spec, draft[spec.field]));
			const invalid = parsed.some((entry) => entry === void 0);
			const dirty = FIELDS.some((spec, index) => parsed[index] !== value[spec.field]);
			dirtyRef.current = dirty;
			if (status.phase === "unavailable") return null;
			const save = () => {
				const patch = {};
				FIELDS.forEach((spec, index) => {
					const next = parsed[index];
					if (next !== void 0 && next !== value[spec.field]) Object.assign(patch, { [spec.field]: next });
				});
				setSaving(true);
				setFailed(false);
				store.save(patch).then(() => {
					setSaving(false);
				}, () => {
					setSaving(false);
					setFailed(true);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				className: open ? "wbs-card wbs-card--open" : "wbs-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "wbs-header",
					"aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}：博查搜索`,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "wbs-headText",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wbs-name",
								children: "博查搜索"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "wbs-desc",
								children: "bocha_web_search 工具的接口与默认值。"
							})]
						}),
						dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wbs-pending",
							children: "未保存"
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "wbs-badge",
							children: "自定义"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: open ? "wbs-chevron wbs-chevron--open" : "wbs-chevron" })
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "wbs-body",
					children: [
						status.phase === "ready" && !status.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "wbs-readOnly",
							role: "status",
							children: "配置文件当前不可写。"
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wbs-field",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wbs-fieldHead",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
											className: "wbs-label",
											htmlFor: keyId,
											children: "API 密钥"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "wbs-secretState",
											children: keyConfigured === void 0 ? "状态未知" : keyConfigured ? keySource === "env" ? "已配置 · 环境变量" : "已配置" : "未配置"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
											id: keyId,
											className: "wbs-input",
											type: "password",
											autoComplete: "off",
											placeholder: keyConfigured === true ? "已配置，填入可替换" : "直接填入密钥",
											value: keyDraft,
											disabled: keyBusy || keyWritable === false,
											onChange: (event) => {
												setKeyDraft(event.target.value);
											}
										})
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "wbs-secretActions",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wbs-save",
										disabled: keyBusy || keyWritable === false || keyDraft === "",
										onClick: () => {
											setKeyBusy(true);
											store.writeKey(keyDraft).finally(() => {
												setKeyBusy(false);
												setKeyDraft("");
											});
										},
										children: keyBusy ? "保存中" : "保存密钥"
									}), keyConfigured === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wbs-discard",
										disabled: keyBusy || keyWritable === false,
										onClick: () => {
											setKeyBusy(true);
											store.writeKey("").finally(() => {
												setKeyBusy(false);
											});
										},
										children: "清除"
									}) : null]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
									className: "wbs-hint",
									children: [
										keyWritable === false ? "当前值来自启动 dsh 时的环境变量，这一层本进程改不了——要在这里管理密钥，先从环境里去掉它。" : "通过「密钥引用名」存进凭据域，永远不会被读回浏览器——所以这里只能告诉你有没有，不能显示是什么。",
										" ",
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
											className: "wbs-link",
											href: API_KEYS_URL,
											target: "_blank",
											rel: "noreferrer noopener",
											children: "获取密钥 ↗"
										})
									]
								})
							]
						}),
						FIELDS.map((spec, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wbs-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "wbs-fieldHead",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
										className: "wbs-label",
										htmlFor: ids[spec.field],
										children: spec.label
									}),
									overridden.has(spec.field) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: "wbs-reset",
										disabled: !status.writable || saving,
										title: "改回 cordis.yml 里的值",
										onClick: () => {
											store.reset(spec.field);
										},
										children: "恢复"
									}) : null,
									spec.kind === "boolean" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: ids[spec.field],
										type: "checkbox",
										checked: draft[spec.field] === true,
										disabled: !status.writable,
										onChange: (event) => {
											setDraft({
												...draft,
												[spec.field]: event.target.checked
											});
										}
									}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										id: ids[spec.field],
										className: parsed[index] === void 0 ? "wbs-input wbs-input--bad" : "wbs-input",
										type: "text",
										inputMode: spec.kind === "number" ? "numeric" : "text",
										value: String(draft[spec.field]),
										disabled: !status.writable,
										"aria-invalid": parsed[index] === void 0,
										onChange: (event) => {
											setDraft({
												...draft,
												[spec.field]: event.target.value
											});
										}
									})
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "wbs-hint",
								children: [spec.hint, overridden.has(spec.field) ? null : ` 当前继承自 cordis.yml（${String(DEFAULT_CONFIG[spec.field])} 为内置默认）。`]
							})]
						}, spec.field)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "wbs-footer",
							children: [
								failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "wbs-failed",
									role: "status",
									children: "保存失败。"
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wbs-discard",
									disabled: !dirty || saving,
									onClick: () => {
										setDraft(draftOf(value));
										setFailed(false);
									},
									children: "放弃"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "wbs-save",
									disabled: !dirty || invalid || saving || !status.writable,
									onClick: save,
									children: saving ? "保存中" : "保存"
								})
							]
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/index.tsx
		/**
		* Bocha web-search plugin, browser half: one card in Settings → Plugins.
		*
		* The tool itself is entirely host-side; this half exists only so the
		* configuration the Host resolves per search is editable without hand-editing
		* cordis.yml. The two halves pair through the settings namespace alone — the
		* configurable-plugins tab dispatches a card by the namespace its Host
		* counterpart registered, and never learns what either means.
		*/
		const inject = ["slots"];
		const CSS = `
  .wbs-card {
    list-style: none;
    position: relative;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 12px;
    background: var(--dsw-alias-bg-layer-3);
    transition: border-color .16s, background .16s;
  }
  .wbs-card:hover {
    border-color: var(--dsw-alias-label-dimmed);
  }
  .wbs-card--open {
    background: var(--dsw-alias-bg-layer-2);
    border-color: var(--dsw-alias-label-dimmed);
  }
  /* Out-of-tree marker: the stripe separates this card while scanning the
     column, the pill in the header names the reason once you look. */
  .wbs-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 45%, transparent);
  }
  .wbs-header {
    width: 100%;
    appearance: none;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 12px;
  }
  .wbs-header:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -2px;
  }
  .wbs-headText {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .wbs-name {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--dsw-alias-label-primary);
  }
  .wbs-desc {
    font-size: 13px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-pending {
    flex: none;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    line-height: 17px;
    font-weight: 500;
    white-space: nowrap;
    background: var(--dsw-alias-bg-module-platform);
    color: var(--dsw-alias-label-secondary);
  }
  .wbs-badge {
    flex: none;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    line-height: 17px;
    font-weight: 500;
    white-space: nowrap;
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
    color: var(--dsw-alias-state-business-primary);
  }
  .wbs-chevron {
    flex: none;
    color: var(--dsw-alias-label-tertiary);
    transition: transform .16s;
  }
  .wbs-chevron--open {
    transform: rotate(180deg);
  }
  .wbs-body {
    border-top: 1px solid var(--dsw-alias-border-l2);
    margin: 0 16px;
    padding-bottom: 8px;
  }
  .wbs-readOnly {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 0;
  }
  .wbs-field + .wbs-field {
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
  .wbs-fieldHead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .wbs-label {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--dsw-alias-label-primary);
  }
  .wbs-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-link {
    color: var(--dsw-alias-state-business-primary);
    text-decoration: none;
    white-space: nowrap;
  }
  .wbs-link:hover {
    text-decoration: underline;
  }
  .wbs-link:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: 2px;
    border-radius: 3px;
  }
  .wbs-reset {
    flex: none;
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-secondary);
    cursor: pointer;
  }
  .wbs-reset:hover:not(:disabled) {
    color: var(--dsw-alias-label-primary);
  }
  .wbs-reset:disabled {
    cursor: default;
    opacity: 0.5;
  }
  .wbs-input {
    width: 220px;
    max-width: 60%;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 8px;
    background: var(--dsw-alias-bg-layer-3);
    color: var(--dsw-alias-label-primary);
    font: inherit;
    font-size: 13px;
  }
  .wbs-input:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -1px;
  }
  .wbs-input--bad {
    border-color: var(--dsw-alias-label-error);
  }
  .wbs-input:disabled {
    opacity: 0.5;
  }
  .wbs-secretState {
    flex: none;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .wbs-secretActions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .wbs-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 0 4px;
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
  .wbs-failed {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-error);
  }
  .wbs-discard,
  .wbs-save {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 5px 14px;
    font: inherit;
    font-size: 13px;
    line-height: 1.5;
    cursor: pointer;
  }
  .wbs-discard {
    border-color: var(--dsw-alias-border-l2);
    background: none;
    color: var(--dsw-alias-label-secondary);
  }
  .wbs-discard:hover:not(:disabled) {
    color: var(--dsw-alias-label-primary);
    border-color: var(--dsw-alias-label-dimmed);
  }
  .wbs-save {
    background: var(--dsw-alias-label-primary);
    color: var(--dsw-alias-bg-layer-3);
  }
  .wbs-discard:disabled,
  .wbs-save:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .wbs-discard:focus-visible,
  .wbs-save:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .wbs-chevron {
      transition: none;
    }
  }
`;
		/**
		* Client plugin body: own the injected stylesheet for the plugin's lifetime and
		* seat the card.
		* @param ctx - this plugin's client context.
		*/
		function apply(ctx) {
			const styleEl = document.createElement("style");
			styleEl.textContent = CSS;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => {
				styleEl.remove();
			});
			const store = createSettingsStore();
			ctx.inject([
				"settingsScope",
				"connection",
				"remote"
			], (settingsCtx) => {
				settingsCtx.effect(() => store.attach(settingsCtx.settingsScope.bind({ namespace: WEB_SEARCH_NAMESPACE }), settingsCtx.get("connection").api), "web-search: configuration section");
				settingsCtx.effect(() => settingsCtx.remote.$on("credentials/updated", () => {
					store.refreshKey();
				}), "web-search: credential invalidations");
			});
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: WEB_SEARCH_NAMESPACE
			}, () => react.createElement(SettingsCard, { store })));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map