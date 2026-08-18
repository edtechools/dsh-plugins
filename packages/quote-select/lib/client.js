window.__ModuleLoader__.load({
	id: "dsh-plugin-quote-select",
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
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/quote-block.ts
		/**
		* Role label as it appears in the draft. The parser accepts exactly these two
		* words, so widening the union means widening the pattern below with it.
		*/
		const ROLE_LABEL = {
			user: "用户",
			assistant: "助手",
			unknown: ""
		};
		const QUOTE_LINE = /^> 引用(\d+)(?:（(用户|助手)）)?：(.*)$/;
		const COMMENT_LINE = /^> 评论(\d+)：(.*)$/;
		/** Map a parsed role label back to its tag; an absent label is an untagged quote. */
		function roleOfLabel(label) {
			if (label === "用户") return "user";
			if (label === "助手") return "assistant";
			return "unknown";
		}
		/**
		* Flatten and cap one captured selection. Called once, at capture: the passage
		* occupies a single draft line, so its own line breaks must go, and an
		* over-long one is cut with an ellipsis that says so to reader and model alike.
		* @param raw - the selection as the browser reported it.
		* @param max - longest passage kept, from the plugin's settings section.
		* @returns the single-line passage stored in the draft.
		*/
		function normalizeQuoteText(raw, max) {
			const flat = raw.replace(/\s+/g, " ").trim();
			return flat.length <= max ? flat : `${flat.slice(0, max)}…`;
		}
		/**
		* Make one comment storable without disturbing what the user typed: line breaks
		* would end the comment's line and are folded to spaces, length is capped, and
		* surrounding spaces are deliberately left alone so a comment being edited in
		* the strip round-trips through the draft character for character.
		* @param raw - the comment as typed.
		* @param max - longest comment kept, from the plugin's settings section.
		* @returns the comment as stored on its draft line.
		*/
		function sanitizeComment(raw, max) {
			const flat = raw.replace(/[\r\n]+/g, " ");
			return flat.length <= max ? flat : flat.slice(0, max);
		}
		/**
		* Render quotes and message back into one draft. Numbering is assigned here, so
		* a removal renumbers what remains and the draft never shows a gap.
		* @param quotes - the quotes, in strip order.
		* @param body - the message the user is writing, without the prefix.
		* @returns the full draft text.
		*/
		function composeDraft(quotes, body) {
			if (quotes.length === 0) return body;
			const lines = [];
			quotes.forEach((quote, index) => {
				const number = index + 1;
				const label = ROLE_LABEL[quote.role];
				lines.push(`> 引用${number}${label === "" ? "" : `（${label}）`}：${quote.text}`);
				if (quote.comment !== "") lines.push(`> 评论${number}：${quote.comment}`);
			});
			return `${lines.join("\n")}\n\n${body}`;
		}
		/**
		* Recover quotes and message from a draft. Only a leading run of quote/comment
		* lines counts, so the same syntax further down the message is the user's own
		* Markdown and is left in the body untouched.
		* @param draft - the current composer draft.
		* @returns the quotes and the remaining message; no leading run yields no quotes and the draft verbatim.
		*/
		function parseDraft(draft) {
			const lines = draft.split("\n");
			const byNumber = /* @__PURE__ */ new Map();
			let cursor = 0;
			for (; cursor < lines.length; cursor += 1) {
				const line = lines[cursor] ?? "";
				const quoted = QUOTE_LINE.exec(line);
				if (quoted !== null) {
					const number = Number(quoted[1]);
					byNumber.set(number, {
						text: quoted[3] ?? "",
						comment: byNumber.get(number)?.comment ?? "",
						role: roleOfLabel(quoted[2])
					});
					continue;
				}
				const commented = COMMENT_LINE.exec(line);
				if (commented !== null) {
					const number = Number(commented[1]);
					const existing = byNumber.get(number);
					byNumber.set(number, {
						text: existing?.text ?? "",
						comment: commented[2] ?? "",
						role: existing?.role ?? "unknown"
					});
					continue;
				}
				break;
			}
			const quotes = [...byNumber.entries()].sort(([a], [b]) => a - b).map(([, quote]) => quote).filter((quote) => quote.text !== "");
			if (quotes.length === 0) return {
				quotes: [],
				body: draft
			};
			return {
				quotes,
				body: lines.slice(cursor).join("\n").replace(/^\n+/, "")
			};
		}
		//#endregion
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
		//#region src/client/settings-store.ts
		/**
		* This plugin's limits, mirrored locally over the durable settings section.
		*
		* A local mirror rather than reads straight off the scope: the quoting surfaces
		* render synchronously and the scope's first value arrives asynchronously, so
		* the mirror is what lets activation proceed at the schema defaults and adopt
		* the stored values when they land. Without a settings provider composed the
		* mirror is never attached, and the defaults are simply what the plugin uses.
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
		* Narrow one numeric field off a wire section, keeping the last good value when
		* the Host does not carry it or carries something else.
		*
		* Version skew is an ORDINARY state here rather than an edge: the browser
		* bundle updates on a page refresh while the Host's registered schema updates
		* only on a restart, so a field this build knows about is routinely missing
		* from the Host that answers it. Copying the section wholesale would put
		* `undefined` straight into the limits every quoting surface reads.
		* @param raw - the field as the Host sent it.
		* @param fallback - the value to keep.
		* @returns the field, or the fallback.
		*/
		function pickNumber(raw, fallback) {
			return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
		}
		/** Build the store. Starts at the schema defaults and unattached. */
		function createSettingsStore() {
			const listeners = /* @__PURE__ */ new Set();
			let value = { ...DEFAULT_CONFIG };
			let status = UNAVAILABLE;
			let scope;
			const notify = () => {
				for (const listener of listeners) listener();
			};
			return {
				get: () => value,
				status: () => status,
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
				attach: (bound) => {
					scope = bound;
					const sync = () => {
						const snapshot = bound.getSnapshot();
						const section = snapshot.value;
						const nextStatus = {
							phase: snapshot.status,
							writable: snapshot.writable === true && snapshot.status === "ready"
						};
						const nextValue = section === void 0 ? value : {
							maxQuoteLength: pickNumber(section.maxQuoteLength, value.maxQuoteLength),
							maxCommentLength: pickNumber(section.maxCommentLength, value.maxCommentLength),
							maxQuotes: pickNumber(section.maxQuotes, value.maxQuotes)
						};
						if (!(nextValue.maxQuoteLength !== value.maxQuoteLength || nextValue.maxCommentLength !== value.maxCommentLength || nextValue.maxQuotes !== value.maxQuotes || nextStatus.phase !== status.phase || nextStatus.writable !== status.writable)) return;
						value = nextValue;
						status = nextStatus;
						notify();
					};
					sync();
					const off = bound.subscribe(sync);
					return () => {
						off();
						scope = void 0;
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
		* rows (a list item whose header discloses the controls in place, with the save
		* that writes them) so this card and the shipped ones read as one stack. They
		* are copied rather than imported: the harness hashes its class names per build
		* and its card components sit outside the shell's frozen module table, so a
		* restyle upstream needs the same edit here.
		*
		* Edits stage rather than apply per keystroke, matching the shipped cards for
		* the reason they do it — these are numbers, and writing "6" on the way to
		* "600" would store a value the user never chose. The sibling turn-nav card
		* applies immediately because a switch has no intermediate states.
		*/
		const FIELDS = [
			{
				field: "maxQuoteLength",
				label: "单条引用上限",
				hint: "超出后截断并接省略号。"
			},
			{
				field: "maxCommentLength",
				label: "单条评论上限",
				hint: "同时是评论输入框的 maxLength。"
			},
			{
				field: "maxQuotes",
				label: "每条消息的引用条数",
				hint: "到顶后药丸拒绝，而不是悄悄丢掉一条。"
			}
		];
		/** Project the committed section into editable text. */
		function draftOf(value) {
			return {
				maxQuoteLength: String(value.maxQuoteLength),
				maxCommentLength: String(value.maxCommentLength),
				maxQuotes: String(value.maxQuotes)
			};
		}
		/**
		* Parse one staged field, or undefined when it is not a whole number inside
		* the schema's own range — the card offers no value the Host would reject.
		* @param field - which limit is being parsed.
		* @param raw - the staged text.
		* @returns the value, or undefined when it cannot be saved.
		*/
		function parseField(field, raw) {
			if (!/^\d+$/.test(raw.trim())) return void 0;
			const parsed = Number(raw.trim());
			const range = LIMITS[field];
			return parsed >= range.min && parsed <= range.max ? parsed : void 0;
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
			const [draft, setDraft] = react.useState(() => draftOf(store.get()));
			const [saving, setSaving] = react.useState(false);
			const [failed, setFailed] = react.useState(false);
			const ids = {
				maxQuoteLength: react.useId(),
				maxCommentLength: react.useId(),
				maxQuotes: react.useId()
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
				if (!dirtyRef.current) setDraft(draftOf(next));
			}), [store]);
			const parsed = FIELDS.map((spec) => parseField(spec.field, draft[spec.field]));
			const invalid = parsed.some((entry) => entry === void 0);
			const dirty = FIELDS.some((spec, index) => parsed[index] !== value[spec.field]);
			dirtyRef.current = dirty;
			if (status.phase === "unavailable") return null;
			const discard = () => {
				setDraft(draftOf(value));
				setFailed(false);
			};
			const save = () => {
				const patch = {};
				FIELDS.forEach((spec, index) => {
					const next = parsed[index];
					if (next !== void 0 && next !== value[spec.field]) patch[spec.field] = next;
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
				className: open ? "qsl-set-card qsl-set-card--open" : "qsl-set-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: "qsl-set-header",
					"aria-expanded": open,
					"aria-label": `${open ? "收起" : "展开"}：划词引用`,
					onClick: () => {
						setOpen(!open);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "qsl-set-headText",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qsl-set-name",
								children: "划词引用"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qsl-set-desc",
								children: "选中消息文本，引用进输入框。"
							})]
						}),
						dirty ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "qsl-set-pending",
							children: "未保存"
						}) : null,
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "qsl-set-badge",
							children: "自定义"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: open ? "qsl-set-chevron qsl-set-chevron--open" : "qsl-set-chevron" })
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "qsl-set-body",
					children: [
						status.phase === "ready" && !status.writable ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: "qsl-set-readOnly",
							role: "status",
							children: "配置文件当前不可写。"
						}) : null,
						FIELDS.map((spec, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "qsl-set-field",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qsl-set-fieldHead",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("label", {
									className: "qsl-set-label",
									htmlFor: ids[spec.field],
									children: spec.label
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									id: ids[spec.field],
									className: parsed[index] === void 0 ? "qsl-set-input qsl-set-input--bad" : "qsl-set-input",
									type: "text",
									inputMode: "numeric",
									value: draft[spec.field],
									disabled: !status.writable,
									"aria-invalid": parsed[index] === void 0,
									onChange: (event) => {
										setDraft({
											...draft,
											[spec.field]: event.target.value
										});
									}
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "qsl-set-hint",
								children: [
									spec.hint,
									" ",
									LIMITS[spec.field].min,
									"–",
									LIMITS[spec.field].max
								]
							})]
						}, spec.field)),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "qsl-set-footer",
							children: [
								failed ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: "qsl-set-failed",
									role: "status",
									children: "保存失败。"
								}) : null,
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "qsl-set-discard",
									disabled: !dirty || saving,
									onClick: discard,
									children: "放弃"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "qsl-set-save",
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
		//#region src/client/chat-dom.ts
		/** Highlight registry name; also the `::highlight()` selector in this plugin's stylesheet. */
		const HIGHLIGHT_NAME = "dsh-quote-select";
		/** Chat node kinds whose text is the assistant speaking. */
		const ASSISTANT_KINDS = /* @__PURE__ */ new Set(["assistant-step", "turn-tail"]);
		/**
		* Resolve the chat node a selection endpoint sits in. Selections outside the
		* conversation flow — the composer, the sidebar, a tool panel — resolve to
		* null, which is what keeps the pill off everything that is not a message.
		* @param node - a selection endpoint, typically `Selection.anchorNode`.
		* @returns the passage's author, or null when the endpoint is not in a chat node.
		*/
		function resolveQuoteSource(node) {
			const seat = (node instanceof HTMLElement ? node : node?.parentElement ?? null)?.closest("[data-chat-flow-kind]") ?? null;
			if (seat === null) return null;
			const kind = seat.getAttribute("data-chat-flow-kind");
			if (kind === "user") return { role: "user" };
			return { role: kind !== null && ASSISTANT_KINDS.has(kind) ? "assistant" : "unknown" };
		}
		/**
		* Hand the composer back the focus a quote action took, with the caret at the
		* end — where the message body now continues. Deferred one frame because the
		* draft write that precedes it has not reached the textarea yet: React commits
		* on the microtask queue, which a rAF callback runs after.
		*/
		function focusComposerAtEnd() {
			requestAnimationFrame(() => {
				const textarea = document.querySelector("[data-input-scroll] textarea");
				if (textarea === null || textarea.disabled) return;
				textarea.focus({ preventScroll: true });
				textarea.setSelectionRange(textarea.value.length, textarea.value.length);
			});
		}
		/**
		* Paint the quoted passages in place through the CSS Custom Highlight API. The
		* ranges are live, so they follow reflow and scrolling for free and collapse on
		* their own when the message that holds them re-renders — a collapsed one
		* simply stops painting, which is the right answer for a passage whose DOM is
		* gone. Absent API support (older engines) turns the highlight off and leaves
		* every other surface working.
		* @param ranges - the live ranges of the currently collected quotes.
		*/
		function paintQuoteHighlight(ranges) {
			const registry = CSS.highlights;
			if (registry === void 0 || typeof Highlight === "undefined") return;
			const live = ranges.filter((range) => range.startContainer.isConnected && range.endContainer.isConnected);
			if (live.length === 0) {
				registry.delete(HIGHLIGHT_NAME);
				return;
			}
			registry.set(HIGHLIGHT_NAME, new Highlight(...live));
		}
		/** Viewport margin a badge is kept inside, so one against the right edge stays whole. */
		const BADGE_MARGIN = 6;
		/**
		* Horizontal room one badge needs. Used only to separate two badges that land
		* on the same line — a rendered badge is narrower than this for single digits,
		* so the gap is generous rather than exact, which is the right error to make
		* for a marker that must never sit on top of another one.
		*/
		const BADGE_CLEARANCE = 20;
		/** Vertical distance under which two badges count as sharing a line. */
		const SAME_LINE_EPSILON = 4;
		/**
		* The band of viewport where transcript text is actually visible.
		*
		* The composer is sticky INSIDE the conversation scrollport, so the
		* scrollport's own bottom edge sits behind it and cannot be the limit. The
		* seat is found by walking up from the textarea to the first sticky ancestor
		* rather than by class name, because the harness hashes its class names per
		* build; the walk is stable across dock rows appearing and disappearing above
		* the composer card.
		* @returns the visible band, or null when no conversation is mounted.
		*/
		function transcriptBand() {
			const scrollport = document.querySelector("[data-conversation-scroll]");
			if (scrollport === null) return null;
			const rect = scrollport.getBoundingClientRect();
			let bottom = rect.bottom;
			let node = document.querySelector("[data-input-scroll]")?.parentElement ?? null;
			while (node !== null && node !== scrollport) {
				if (getComputedStyle(node).position === "sticky") {
					bottom = Math.min(bottom, node.getBoundingClientRect().top);
					break;
				}
				node = node.parentElement;
			}
			return {
				top: rect.top,
				bottom
			};
		}
		/**
		* Place a badge at the trailing edge of each live quote. The LAST client rect
		* is the anchor, not the first: a passage spanning several lines ends on the
		* last one, and that is where a marker reads as "this passage, up to here".
		*
		* `top` is the line box's TOP, not its middle: a quote that ends mid-sentence
		* would otherwise seat the badge between two words at reading height and cut
		* the sentence in half. Riding the top edge puts it in the leading, the way a
		* footnote marker does, where it interrupts nothing.
		*
		* A range whose message has re-rendered has collapsed and yields no rects — it
		* drops out here exactly as it drops out of the highlight. Ranges outside the
		* visible transcript band drop out too: the badge layer is portalled to
		* document.body, so it is outside the conversation's stacking context and no
		* z-index can seat it under the composer — not painting what has scrolled
		* behind the composer is the only thing that works.
		* @param ranges - the live ranges of the currently collected quotes.
		* @returns one placement per visible quote, in quote order.
		*/
		function placeQuoteBadges(ranges) {
			const band = transcriptBand();
			if (band === null) return [];
			const placements = [];
			ranges.forEach((range, index) => {
				const rects = range.getClientRects();
				const rect = rects[rects.length - 1];
				if (rect === void 0 || rect.width === 0 && rect.height === 0) return;
				if (rect.top < band.top || rect.top > band.bottom) return;
				let left = Math.min(rect.right, window.innerWidth - BADGE_MARGIN);
				const previous = placements[placements.length - 1];
				if (previous !== void 0 && Math.abs(previous.top - rect.top) < SAME_LINE_EPSILON && left - previous.left < BADGE_CLEARANCE) left = previous.left + BADGE_CLEARANCE;
				placements.push({
					index,
					top: rect.top,
					left
				});
			});
			return placements;
		}
		//#endregion
		//#region src/client/styles.ts
		/**
		* This plugin's stylesheet, injected as one package-owned `<style>` for the
		* plugin's lifetime. Every color is a theme token, so both surfaces follow the
		* app's light/dark switch with no logic of their own; the two geometry recipes
		* that must match shipped UI — the floating pill against the product tooltip,
		* the strip against the composer dock — are copied value for value from
		* `ui-primitives/Tooltip.module.css` and
		* `ui-conversation/skeleton/TodoPanel.module.css`, because the harness hashes
		* its class names per build and they cannot be inherited from here. A restyle
		* upstream needs the same edit here.
		*/
		const CSS$1 = `
  /*
   * Quoted passages, painted in place through the CSS Custom Highlight API
   * (see chat-dom.ts). A tinted wash plus an underline rather than a border:
   * the passage keeps its own line height, so marking one changes no layout in
   * the transcript. Two channels because a wash alone is easy to miss against
   * a busy answer — the underline survives at any background density, and
   * the highlight pseudo-element accepts text-decoration where it accepts no
   * box property.
   */
  ::highlight(dsh-quote-select) {
    background-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 26%, transparent);
    color: var(--dsw-alias-label-primary);
    text-decoration: underline;
    text-decoration-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 70%, transparent);
    text-decoration-thickness: 1.5px;
    text-underline-offset: 2px;
  }

  /*
   * Numbered badge trailing each quoted passage, seated like a footnote
   * marker. The number and the accent are the strip's (.qsl-index), so the
   * marker in the transcript and the row in the strip read as one object.
   *
   * Never hit-testable: it sits over the transcript, where every pixel already
   * belongs to selecting text or to a message action.
   */
  .qsl-badge {
    position: fixed;
    /* Modest: the layer is portalled to document.body, so this only orders it
       against other body-level layers (the pill at 110, menus and modals at
       100). Seating it under the composer is geometry, not z-index — the
       conversation's own stacking context is unreachable from here. */
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    /*
     * Sized to fit a line's leading rather than to be read at arm's length.
     * The extent is the highlight's job; this only has to say WHICH quote, so
     * it is the smallest thing that stays legible — a bigger badge cannot fit
     * above the text without landing on the line before it.
     */
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 4px;
    background: var(--dsw-alias-state-business-primary);
    color: var(--dsw-static-neutral-bluish-00);
    font-family: inherit;
    font-size: 10px;
    line-height: 1;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
    /*
     * Trails the passage instead of splitting it. The +2px keeps the badge off
     * the last glyph — pulling it left seats it BETWEEN two characters, which
     * cuts a word or a number in half — and -40% lifts it into the line's own
     * leading, shallow enough that it does not reach the line above.
     */
    transform: translate(2px, -40%);
    /*
     * drop-shadow rather than box-shadow: it follows the rendered silhouette,
     * so the legibility outline stays even where the badge overlaps a glyph.
     */
    filter:
      drop-shadow(0 0 1px var(--dsw-alias-bg-base))
      drop-shadow(0 1px 2px rgba(0, 0, 0, 0.18));
    animation: qsl-badge-in 160ms var(--ds-ease-in-out);
  }
  @keyframes qsl-badge-in {
    from {
      opacity: 0;
      transform: translate(2px, -40%) scale(0.6);
    }
  }

  /* ---- Floating pill over the selection ---- */

  .qsl-pill {
    position: fixed;
    z-index: 110;
    display: flex;
    align-items: center;
    box-sizing: border-box;
    height: 30px;
    padding: 2px;
    border-radius: 10px;
    background: var(--dsw-alias-tooltip-bg);
    color: var(--dsw-static-neutral-bluish-00);
    box-shadow: var(--dsw-shadow-lv3);
    font-family: inherit;
    font-size: 13px;
    line-height: 20px;
    animation: qsl-pill-in 140ms var(--ds-ease-in-out);
  }
  @keyframes qsl-pill-in {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
  }

  .qsl-action {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 26px;
    padding: 0 9px;
    border-radius: 8px;
    color: inherit;
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }
  .qsl-action:hover {
    background: rgba(255, 255, 255, 0.12);
  }
  .qsl-action:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: -2px;
  }
  .qsl-action[aria-disabled='true'] {
    opacity: 0.45;
    cursor: not-allowed;
  }
  .qsl-action[aria-disabled='true']:hover {
    background: transparent;
  }
  .qsl-action svg {
    flex: none;
    display: block;
  }
  /* Hairline between the two actions, drawn on the divider itself so neither
     button's hover fill has to leave room for it. */
  .qsl-divider {
    flex: none;
    width: 1px;
    height: 16px;
    margin: 0 1px;
    background: rgba(255, 255, 255, 0.16);
  }

  .qsl-commentField {
    all: unset;
    box-sizing: border-box;
    width: 232px;
    height: 26px;
    padding: 0 8px;
    color: inherit;
    font: inherit;
  }
  .qsl-commentField::placeholder {
    color: rgba(255, 255, 255, 0.5);
  }
  .qsl-confirm {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--dsw-alias-state-business-primary);
    color: var(--dsw-static-neutral-bluish-00);
    cursor: pointer;
  }
  .qsl-confirm:hover {
    filter: brightness(1.08);
  }
  .qsl-confirm:focus-visible {
    outline: 2px solid var(--dsw-static-neutral-bluish-00);
    outline-offset: -2px;
  }

  /* ---- Quote strip above the composer ---- */

  /* Geometry mirrors the todo/queue/goal dock cards so all four line up in the
     composer stack; the variables are the conversation root's own. */
  .qsl-strip {
    box-sizing: border-box;
    flex: none;
    overflow: hidden;
    margin: 0 auto;
    width: calc(
      100% -
      var(--dsh-composer-side-clearance) -
      var(--dsh-composer-side-clearance) -
      var(--dsh-composer-dock-inset) -
      var(--dsh-composer-dock-inset) -
      var(--dsh-composer-dock-inset) -
      var(--dsh-composer-dock-inset)
    );
    max-width: calc(
      var(--dsh-composer-card-max-width) -
      var(--dsh-composer-dock-inset) -
      var(--dsh-composer-dock-inset) -
      var(--dsh-composer-dock-inset) -
      var(--dsh-composer-dock-inset)
    );
    border: 1px solid var(--dsw-alias-border-l1);
    border-radius: 12px;
    background: var(--dsw-specific-tip);
    color: var(--dsw-alias-label-primary);
    font-family: inherit;
  }

  .qsl-head {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 36px;
    padding: 0 6px 0 12px;
  }
  .qsl-summary {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
    height: 100%;
    color: inherit;
    font: inherit;
    font-size: 13px;
    line-height: 20px;
    cursor: pointer;
  }
  .qsl-summary:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: -2px;
    border-radius: 8px;
  }
  .qsl-summary svg {
    flex: none;
    display: block;
  }
  .qsl-mark {
    color: var(--dsw-alias-state-business-primary);
  }
  .qsl-count {
    flex: none;
    font-weight: 500;
  }
  /* Collapsed peek at the first passage: the strip says what is in it without
     being opened, and gives up its width first when the row gets tight. */
  .qsl-peek {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    color: var(--dsw-alias-label-tertiary);
  }
  .qsl-chevron {
    flex: none;
    color: var(--dsw-alias-label-tertiary);
    transition: transform 140ms var(--ds-ease-in-out);
  }
  .qsl-chevron--open {
    transform: rotate(180deg);
  }

  .qsl-iconButton {
    all: unset;
    box-sizing: border-box;
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    color: var(--dsw-alias-label-tertiary);
    cursor: pointer;
  }
  .qsl-iconButton:hover {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-label-primary);
  }
  .qsl-iconButton:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: -2px;
  }
  .qsl-iconButton svg {
    display: block;
  }

  .qsl-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 244px;
    margin: 0;
    padding: 0 6px 6px;
    overflow-y: auto;
    list-style: none;
  }
  .qsl-item {
    display: grid;
    grid-template-columns: 18px 1fr 24px;
    align-items: start;
    gap: 4px 8px;
    padding: 6px;
    border-radius: 8px;
  }
  .qsl-item:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
  .qsl-index {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    border-radius: 50%;
    background: var(--dsw-alias-state-business-primary);
    color: var(--dsw-static-neutral-bluish-00);
    font-size: 11px;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .qsl-body {
    min-width: 0;
  }
  .qsl-role {
    margin-right: 6px;
    color: var(--dsw-alias-label-tertiary);
    font-size: 12px;
  }
  .qsl-text {
    font-size: 13px;
    line-height: 20px;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  /* Comment input starts as a bare line of text and only draws its box once
     focused, so an empty one reads as an invitation rather than a form field. */
  .qsl-comment {
    all: unset;
    box-sizing: border-box;
    width: 100%;
    margin-top: 4px;
    padding: 2px 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--dsw-alias-label-secondary);
    font: inherit;
    font-size: 12px;
    line-height: 20px;
  }
  .qsl-comment::placeholder {
    color: var(--dsw-alias-label-quaternary);
  }
  .qsl-comment:hover {
    border-color: var(--dsw-alias-border-l2);
  }
  .qsl-comment:focus {
    border-color: var(--dsw-alias-state-business-primary);
    color: var(--dsw-alias-label-primary);
  }

  /* ---- Settings card ---- */

  /*
   * Copied value for value from ui-settings-plugins' PluginCard.module.css and
   * fields.module.css so this card and the shipped ones read as one stack; the
   * harness hashes its class names per build and its card components sit
   * outside the shell's frozen module table, so a restyle upstream needs the
   * same edit here.
   * (No backticks anywhere in this literal — they would end it.)
   */
  .qsl-set-card {
    list-style: none;
    position: relative;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 12px;
    background: var(--dsw-alias-bg-layer-3);
    transition: border-color .16s, background .16s;
  }
  /*
   * Out-of-tree marker. The shipped cards and an installed plugin's card are
   * deliberately identical in structure — they stack as one list — so the fact
   * that this one came from a plugin the user installed has to be said, not
   * implied. Two signals at two reading distances: this stripe is what
   * separates them while scanning the column, the pill in the header is what
   * names the reason once you look.
   */
  .qsl-set-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 45%, transparent);
  }
  .qsl-set-badge {
    flex: none;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    line-height: 17px;
    font-weight: 500;
    white-space: nowrap;
    /* Tinted, not the platform grey the "unsaved" pill uses: the two sit side
       by side and must not read as the same kind of statement. */
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
    color: var(--dsw-alias-state-business-primary);
  }
  .qsl-set-card:hover {
    border-color: var(--dsw-alias-label-dimmed);
  }
  .qsl-set-card--open {
    background: var(--dsw-alias-bg-layer-2);
    border-color: var(--dsw-alias-label-dimmed);
  }
  .qsl-set-header {
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
  .qsl-set-header:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -2px;
  }
  .qsl-set-headText {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .qsl-set-name {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--dsw-alias-label-primary);
  }
  .qsl-set-desc {
    font-size: 13px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  /* Carried on the header so a collapsed card still says it holds edits. */
  .qsl-set-pending {
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
  .qsl-set-chevron {
    flex: none;
    color: var(--dsw-alias-label-tertiary);
    transition: transform .16s;
  }
  .qsl-set-chevron--open {
    transform: rotate(180deg);
  }
  .qsl-set-body {
    border-top: 1px solid var(--dsw-alias-border-l2);
    margin: 0 16px;
    padding-bottom: 8px;
  }
  .qsl-set-readOnly {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .qsl-set-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 0;
  }
  .qsl-set-field + .qsl-set-field {
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
  .qsl-set-fieldHead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .qsl-set-label {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--dsw-alias-label-primary);
  }
  .qsl-set-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .qsl-set-input {
    width: 96px;
    height: 34px;
    padding: 0 12px;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 8px;
    background: var(--dsw-alias-bg-layer-3);
    color: var(--dsw-alias-label-primary);
    font: inherit;
    font-size: 13px;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .qsl-set-input:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -1px;
  }
  .qsl-set-input--bad {
    border-color: var(--dsw-alias-label-error);
  }
  .qsl-set-input:disabled {
    opacity: 0.5;
  }
  .qsl-set-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 12px 0 4px;
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
  .qsl-set-failed {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-error);
  }
  .qsl-set-discard,
  .qsl-set-save {
    appearance: none;
    border: 1px solid transparent;
    border-radius: 8px;
    padding: 5px 14px;
    font: inherit;
    font-size: 13px;
    line-height: 1.5;
    cursor: pointer;
  }
  .qsl-set-discard {
    border-color: var(--dsw-alias-border-l2);
    background: none;
    color: var(--dsw-alias-label-secondary);
  }
  .qsl-set-discard:hover:not(:disabled) {
    color: var(--dsw-alias-label-primary);
    border-color: var(--dsw-alias-label-dimmed);
  }
  .qsl-set-save {
    background: var(--dsw-alias-label-primary);
    color: var(--dsw-alias-bg-layer-3);
  }
  .qsl-set-discard:disabled,
  .qsl-set-save:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .qsl-set-discard:focus-visible,
  .qsl-set-save:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: 1px;
  }

  @media (prefers-reduced-motion: reduce) {
    .qsl-pill,
    .qsl-badge {
      animation: none;
    }
    .qsl-chevron,
    .qsl-set-chevron {
      transition: none;
    }
  }
`;
		//#endregion
		//#region src/client/index.tsx
		/**
		* Quote-selection plugin, browser half: select text in any chat message and a
		* pill floats over the selection offering 「引用」 (quote it into the composer)
		* and 「评论」 (attach a note first). Collected quotes stay marked in the
		* transcript and are listed in a strip above the input, where their comments
		* stay editable until the message is sent.
		*
		* One seat, three surfaces. Everything registers into `conversation.input.dock`
		* — the only slot that carries both the live draft and `inputActions`, which
		* this plugin needs because quotes are stored IN the draft (see
		* quote-block.ts). The pill and the transcript highlight are not dock content;
		* they are portalled to `document.body` and painted through the Highlight API
		* from that same component, so all three surfaces read one state and the seat
		* contributes no layout of its own while the strip is empty.
		*
		* Session scope comes for free with the seat: each session parses its own
		* draft, so quotes never leak across a session switch, and they persist exactly
		* as the draft does.
		*/
		const inject = ["slots"];
		/** Dock order: below the plan strip (0), the queue (20) and the goal bar. */
		const SLOT_ORDER = 30;
		/** Gap between the selection rect and the pill, and the margin the pill keeps inside the viewport. */
		const PILL_GAP = 8;
		const VIEWPORT_MARGIN = 12;
		/** Human label for a quote's author; untagged quotes render no label at all. */
		const ROLE_TEXT = {
			user: "用户",
			assistant: "助手",
			unknown: ""
		};
		/** Quotation glyph. Hand-drawn: the product icon set has no quote mark. */
		function QuoteGlyph({ size = 14 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "currentColor",
				"aria-hidden": "true",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M2.6 4h4.2v3.9c0 2.3-1.4 3.8-3.5 4.1v-1.7c1-.2 1.6-.9 1.7-1.8H2.6V4Zm6.6 0h4.2v3.9c0 2.3-1.4 3.8-3.5 4.1v-1.7c1-.2 1.6-.9 1.7-1.8H9.2V4Z" })
			});
		}
		/** Comment glyph: a speech bubble with a plus. Hand-drawn for the same reason. */
		function CommentGlyph({ size = 14 }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.3",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M13.6 3.1H2.4v6.8h2.3v2.4l2.9-2.4h6Z" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M8 5.1v2.8M6.6 6.5h2.8" })]
			});
		}
		/** Keep a coordinate inside the viewport with a margin on both sides. */
		function clamp(value, min, max) {
			return Math.max(min, Math.min(max, value));
		}
		/**
		* The floating pill. It positions itself after measuring, because its width is
		* whatever its labels come to and it doubles in size when it becomes a comment
		* field — a pre-computed position would be wrong in both states.
		*/
		function SelectionPill(props) {
			const pillRef = react.useRef(null);
			const [comment, setComment] = react.useState("");
			react.useLayoutEffect(() => {
				const pill = pillRef.current;
				if (pill === null) return;
				const { width, height } = pill.getBoundingClientRect();
				const anchor = props.pending.anchor;
				const above = anchor.top - PILL_GAP - height;
				pill.style.left = `${Math.round(clamp(anchor.left + anchor.width / 2 - width / 2, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, window.innerWidth - VIEWPORT_MARGIN - width)))}px`;
				pill.style.top = `${Math.round(above >= VIEWPORT_MARGIN ? above : anchor.bottom + PILL_GAP)}px`;
				pill.style.visibility = "visible";
			}, [props.pending, props.commenting]);
			const quoteHint = props.full ? `一条消息最多引用 ${props.limits.maxQuotes} 处` : void 0;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: pillRef,
				className: "qsl-pill",
				style: {
					visibility: "hidden",
					left: 0,
					top: 0
				},
				onMouseDown: (event) => {
					if (!props.commenting) event.preventDefault();
				},
				children: props.commenting ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
					autoFocus: true,
					className: "qsl-commentField",
					value: comment,
					maxLength: props.limits.maxCommentLength,
					placeholder: "写句评论，回车加入…",
					"aria-label": "为这条引用写评论",
					onChange: (event) => {
						setComment(event.target.value);
					},
					onKeyDown: (event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							props.onCommit(comment);
						}
						if (event.key === "Escape") props.onDismiss();
					}
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: "qsl-confirm",
					"aria-label": "加入引用",
					onClick: () => {
						props.onCommit(comment);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutline14, { size: 14 })
				})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "qsl-action",
						"aria-disabled": props.full,
						title: quoteHint,
						onClick: () => {
							if (!props.full) props.onCommit("");
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuoteGlyph, {}), "引用"]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: "qsl-divider",
						"aria-hidden": "true"
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "qsl-action",
						"aria-disabled": props.full,
						title: quoteHint ?? "先写一句评论再加入",
						onClick: () => {
							if (!props.full) props.onStartComment();
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(CommentGlyph, {}), "评论"]
					})
				] })
			});
		}
		/**
		* The badge layer over the transcript. Positions come from live ranges rather
		* than from React state, so they follow reflow; recomputing on scroll and
		* resize is what keeps them attached, and a passage whose message re-rendered
		* yields no rect and simply stops being drawn.
		*/
		function QuoteBadges({ rangesRef, count }) {
			const [placements, setPlacements] = react.useState([]);
			react.useEffect(() => {
				let frame = null;
				const recompute = () => {
					frame = null;
					setPlacements(placeQuoteBadges(rangesRef.current));
				};
				const schedule = () => {
					if (frame === null) frame = requestAnimationFrame(recompute);
				};
				recompute();
				window.addEventListener("scroll", schedule, true);
				window.addEventListener("resize", schedule);
				return () => {
					if (frame !== null) cancelAnimationFrame(frame);
					window.removeEventListener("scroll", schedule, true);
					window.removeEventListener("resize", schedule);
				};
			}, [rangesRef, count]);
			if (placements.length === 0) return null;
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: placements.map((placement) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: "qsl-badge",
				"aria-hidden": "true",
				style: {
					top: placement.top,
					left: placement.left
				},
				children: placement.index + 1
			}, placement.index)) }), document.body);
		}
		/**
		* The strip above the composer: what is currently attached to this message.
		* Expansion is a click, not a hover — comments are edited in place here, and a
		* panel that closes when the pointer leaves it cannot hold a text field.
		*/
		function QuoteStrip(props) {
			const [expanded, setExpanded] = react.useState(false);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "qsl-strip",
				"aria-label": "待发送的引用",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "qsl-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "qsl-summary",
						"aria-expanded": expanded,
						onClick: () => {
							setExpanded((open) => !open);
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qsl-mark",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuoteGlyph, {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "qsl-count",
								children: [props.quotes.length, " 条引用"]
							}),
							expanded ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qsl-peek",
								children: props.quotes[0]?.text
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {
								size: 14,
								className: expanded ? "qsl-chevron qsl-chevron--open" : "qsl-chevron"
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "qsl-iconButton",
						title: "清空引用",
						"aria-label": "清空引用",
						onClick: props.onClear,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 })
					})]
				}), expanded ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
					className: "qsl-list",
					children: props.quotes.map((quote, index) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
						className: "qsl-item",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "qsl-index",
								"aria-hidden": "true",
								children: index + 1
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "qsl-body",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "qsl-text",
									children: [quote.role === "unknown" ? null : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "qsl-role",
										children: ROLE_TEXT[quote.role]
									}), quote.text]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									className: "qsl-comment",
									value: quote.comment,
									maxLength: props.limits.maxCommentLength,
									placeholder: "添加评论（可选）",
									"aria-label": `第 ${index + 1} 条引用的评论`,
									onChange: (event) => {
										props.onEditComment(index, event.target.value);
									}
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "qsl-iconButton",
								title: "删除这条引用",
								"aria-label": `删除第 ${index + 1} 条引用`,
								onClick: () => {
									props.onRemove(index);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutline16, { size: 14 })
							})
						]
					}, index))
				}) : null]
			});
		}
		/**
		* Client plugin body: own the injected stylesheet for the plugin's lifetime and
		* seat the dock entry. The entry component is defined here so it closes over
		* this plugin's ctx.
		* @param ctx - this plugin's client context.
		*/
		function apply(ctx) {
			const styleEl = document.createElement("style");
			styleEl.textContent = CSS$1;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => {
				styleEl.remove();
			});
			const settingsStore = createSettingsStore();
			ctx.inject([
				"settingsScope",
				"connection",
				"remote"
			], (settingsCtx) => {
				settingsCtx.effect(() => settingsStore.attach(settingsCtx.settingsScope.bind({ namespace: QUOTE_SELECT_NAMESPACE })), "quote-select: limits section");
			});
			/** The dock entry: selection listener, quote store, and all three surfaces. */
			function QuoteDock(props) {
				const { quotes, body } = parseDraft(props.input.draft);
				const [limits, setLimits] = react.useState(settingsStore.get);
				react.useEffect(() => settingsStore.subscribe(() => setLimits(settingsStore.get())), []);
				const [pending, setPending] = react.useState(null);
				const [commenting, setCommenting] = react.useState(false);
				/**
				* Live ranges of the collected quotes, positionally aligned with `quotes`.
				* They cannot live in the draft (a Range is not text), so alignment is
				* maintained by every mutation below and re-checked whenever the count
				* changes: a hand-edit of the quote lines in the textarea moves quotes the
				* ranges know nothing about, and dropping the highlight beats misplacing it.
				*/
				const rangesRef = react.useRef([]);
				/**
				* Mirrors `commenting` for the event handlers. The comment field takes focus
				* the moment it mounts, which collapses the document selection; the mouseup
				* that opened it is still queued behind that, and would run with a stale
				* closure and dismiss the pill the user just asked for. A ref written in the
				* same tick is what the queued handler reads.
				*/
				const commentingRef = react.useRef(false);
				const dismiss = react.useCallback(() => {
					commentingRef.current = false;
					setCommenting(false);
					setPending(null);
				}, []);
				react.useEffect(() => {
					let deferred = 0;
					const sync = () => {
						if (commentingRef.current) return;
						const selection = window.getSelection();
						const text = selection === null ? "" : selection.toString();
						if (selection === null || selection.isCollapsed || text.trim() === "") {
							setPending(null);
							return;
						}
						const source = resolveQuoteSource(selection.anchorNode);
						if (source === null) {
							setPending(null);
							return;
						}
						const range = selection.getRangeAt(0);
						const anchor = range.getBoundingClientRect();
						if (anchor.width === 0 && anchor.height === 0) {
							setPending(null);
							return;
						}
						setPending({
							text,
							role: source.role,
							range: range.cloneRange(),
							anchor
						});
					};
					const onMouseUp = () => {
						window.clearTimeout(deferred);
						deferred = window.setTimeout(sync, 0);
					};
					const onMouseDown = (event) => {
						if (!commentingRef.current) return;
						if (event.target instanceof Element && event.target.closest(".qsl-pill") !== null) return;
						dismiss();
					};
					const onKeyUp = (event) => {
						if (event.key === "Escape") {
							dismiss();
							return;
						}
						if (event.shiftKey) sync();
					};
					const onViewportChange = () => {
						if (commentingRef.current) return;
						setPending(null);
					};
					document.addEventListener("mouseup", onMouseUp);
					document.addEventListener("mousedown", onMouseDown);
					document.addEventListener("keyup", onKeyUp);
					window.addEventListener("scroll", onViewportChange, true);
					window.addEventListener("resize", onViewportChange);
					return () => {
						window.clearTimeout(deferred);
						document.removeEventListener("mouseup", onMouseUp);
						document.removeEventListener("mousedown", onMouseDown);
						document.removeEventListener("keyup", onKeyUp);
						window.removeEventListener("scroll", onViewportChange, true);
						window.removeEventListener("resize", onViewportChange);
					};
				}, [dismiss]);
				react.useEffect(() => {
					if (rangesRef.current.length !== quotes.length) rangesRef.current = [];
					paintQuoteHighlight(rangesRef.current);
				}, [quotes.length]);
				react.useEffect(() => () => {
					paintQuoteHighlight([]);
				}, []);
				const writeQuotes = (next) => {
					props.inputActions.setDraft(composeDraft(next, body));
				};
				const commit = (comment) => {
					if (pending === null || quotes.length >= limits.maxQuotes) return;
					const aligned = rangesRef.current.length === quotes.length ? rangesRef.current : [];
					rangesRef.current = [...aligned, pending.range];
					writeQuotes([...quotes, {
						text: normalizeQuoteText(pending.text, limits.maxQuoteLength),
						comment: sanitizeComment(comment.trim(), limits.maxCommentLength),
						role: pending.role
					}]);
					window.getSelection()?.removeAllRanges();
					dismiss();
					focusComposerAtEnd();
				};
				const removeAt = (index) => {
					if (rangesRef.current.length === quotes.length) rangesRef.current = rangesRef.current.filter((_, at) => at !== index);
					writeQuotes(quotes.filter((_, at) => at !== index));
				};
				const pill = pending === null ? null : (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SelectionPill, {
					pending,
					full: quotes.length >= limits.maxQuotes,
					limits,
					commenting,
					onStartComment: () => {
						commentingRef.current = true;
						setCommenting(true);
					},
					onCommit: commit,
					onDismiss: dismiss
				}), document.body);
				if (quotes.length === 0) return pill;
				return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuoteBadges, {
						rangesRef,
						count: quotes.length
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(QuoteStrip, {
						quotes,
						limits,
						onEditComment: (index, comment) => {
							writeQuotes(quotes.map((quote, at) => at === index ? {
								...quote,
								comment: sanitizeComment(comment, limits.maxCommentLength)
							} : quote));
						},
						onRemove: removeAt,
						onClear: () => {
							rangesRef.current = [];
							writeQuotes([]);
						}
					}),
					pill
				] });
			}
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "quote-select",
				order: SLOT_ORDER
			}, (props) => react.createElement(QuoteDock, props)));
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: QUOTE_SELECT_NAMESPACE
			}, () => react.createElement(SettingsCard, { store: settingsStore })));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map