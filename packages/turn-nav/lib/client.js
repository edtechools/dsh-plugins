window.__ModuleLoader__.load({
	id: "dsh-plugin-turn-nav",
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
		//#region src/client/mark-store.ts
		/**
		* Turn marks: which turns of a conversation the user flagged as worth finding
		* again, kept per session and keyed by chat-node key.
		*
		* Browser-local on purpose, unlike this plugin's two preferences. Those are one
		* boolean each and belong in the settings document; marks are per-session data
		* that grows with every conversation, and that document is one the user opens
		* in a text editor (Settings has an "open configuration file" button) — filling
		* it with machine-generated `{sessionId: [nodeKey…]}` maps would make it
		* unreadable. The Host offers no per-session annotation store to write to
		* instead, so the cost of this choice is real and named: marks do not follow
		* the user to another browser or machine.
		*
		* Growth is bounded by pruning against the live session list rather than by a
		* cap: a mark outlives the session it belongs to only until the next prune.
		*/
		/** Storage key. Namespaced by package so a sibling plugin cannot collide. */
		const STORAGE_KEY = "dsh-plugin-turn-nav.marks";
		/** Read the document, treating any unreadable or malformed state as empty. */
		function read() {
			let raw = null;
			try {
				raw = window.localStorage.getItem(STORAGE_KEY);
			} catch {
				return {};
			}
			if (raw === null) return {};
			try {
				const parsed = JSON.parse(raw);
				if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
				const document = {};
				for (const [sessionId, keys] of Object.entries(parsed)) if (Array.isArray(keys)) document[sessionId] = keys.filter((key) => typeof key === "string");
				return document;
			} catch {
				return {};
			}
		}
		/** Build the store, restoring what the browser holds. */
		function createMarkStore() {
			const listeners = /* @__PURE__ */ new Set();
			let document = read();
			const notify = () => {
				for (const listener of listeners) listener();
			};
			const persist = () => {
				try {
					window.localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
				} catch {}
			};
			return {
				get: (sessionId) => new Set(document[sessionId] ?? []),
				toggle: (sessionId, nodeKey) => {
					const current = document[sessionId] ?? [];
					const next = current.includes(nodeKey) ? current.filter((key) => key !== nodeKey) : [...current, nodeKey];
					if (next.length === 0) {
						const { [sessionId]: _cleared, ...rest } = document;
						document = rest;
					} else document = {
						...document,
						[sessionId]: next
					};
					persist();
					notify();
				},
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				prune: (live) => {
					const keep = new Set(live);
					const next = {};
					let dropped = false;
					for (const [sessionId, keys] of Object.entries(document)) if (keep.has(sessionId)) next[sessionId] = keys;
					else dropped = true;
					if (!dropped) return;
					document = next;
					persist();
					notify();
				}
			};
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* Turn navigation rail plugin, browser half: a hover-reveal rail at the
		* conversation's left edge (shell.overlay). One line per turn (user message +
		* its AI reply). Each line's resting length encodes the turn's weight (chat
		* nodes, log-scaled), so the rail reads as a fingerprint of the conversation
		* rather than a uniform comb. Pointer proximity drives a distance-falloff wave
		* (length / thickness / luminance), scrolling moves the wave peak with the
		* reading position and marks the current turn in the accent color, clicking
		* jumps to that turn, and hovering shows a preview card.
		*
		* Two visual channels carry two different meanings and never compete: the
		* transient pointer wave is achromatic (label-tertiary to label-primary) while
		* the persistent reading position is the accent hue. Per-frame updates write a
		* single `--tnv-w` custom property per line and let CSS derive every visual
		* from it, so pointer tracking never re-renders React.
		*
		* Data: root-scope overlay has no `useSession` standard prop, so the
		* conversation snapshot is subscribed directly through
		* `sessions.binding(id).session` (an ObservableSnapshot). DOM anchors:
		* `[data-conversation-scroll]` is the chat scrollport and
		* `[data-chat-anchor-key]` marks each rendered node.
		*
		* Two preferences, both durable in the Host settings document under this
		* package's namespace and edited from either of two places that never
		* disagree: a switch in the sidebar foot (`sidebar.footer.action`) shows and
		* hides the rail, and the plugin's own card (`settings.plugin.item`) governs
		* that switch as well as the rail. They live here rather than in their own
		* plugin because the state they own is this plugin's own — no seam between two
		* plugins to define.
		*/
		const inject = [
			"slots",
			"sessions",
			"timer"
		];
		/** Sidebar foot order: above the theme switch, which sits at 10. */
		const TOGGLE_SLOT_ORDER = 5;
		/** Vertical pitch per turn, clamped so long conversations still fit before the rail scrolls. */
		const STEP_MIN = 8;
		const STEP_MAX = 16;
		/** Resting line length: `LEN_BASE` for a one-node turn, plus up to `LEN_SPAN` more as weight saturates. */
		const LEN_BASE = 7;
		const LEN_SPAN = 13;
		/**
		* Chat-node count that reaches full length. Tuned near the size of an ordinary
		* multi-step turn so everyday turns spread across the scale instead of piling
		* up at one length; heavier turns saturate rather than dwarfing the rail.
		*/
		const LEN_SATURATION = 24;
		/** Pointer falloff distance, in pitch steps, at which the wave weight reaches zero. */
		const FALLOFF_STEPS = 2.2;
		/** Gap between the rail and the preview card, and the margin the card is clamped to inside the viewport. */
		const CARD_GAP = 10;
		const CARD_MARGIN = 12;
		/** Margin kept between the current line and the track edge when the rail auto-scrolls. */
		const TRACK_REVEAL_MARGIN = 20;
		/** Delay before the rail fades back after conversation scrolling stops. */
		const SCROLL_REST_MS = 400;
		/** Scroll distance from the end still counted as "at the bottom", absorbing fractional scroll offsets. */
		const BOTTOM_EPSILON = 4;
		/**
		* Window in which a click's scroll must produce its first scroll event. A click
		* whose target is already in place scrolls nothing and would otherwise leave the
		* index pinned forever; once any scroll arrives, settling owns the pin instead.
		*/
		const PIN_SAFETY_MS = 150;
		/** The rail's own width, mirrored from `.tnv` so label geometry can start after it. */
		const RAIL_WIDTH = 42;
		/** Gap between the rail and a mark label, and the room a label needs before it is worth drawing. */
		const LABEL_GAP = 6;
		const LABEL_MIN_WIDTH = 56;
		/** Cap: a label names a turn, it does not reproduce it. */
		const LABEL_MAX_WIDTH = 190;
		const CSS = `
  .tnv {
    position: fixed;
    z-index: 50;
    /* Wide enough for the longest line at full wave (LEN_BASE + LEN_SPAN + current + wave). */
    width: 42px;
    padding-left: 4px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    pointer-events: auto;
    /* Idle multiplier folded into each line's opacity; the current turn ignores it. */
    --tnv-idle: 0.55;
  }
  .tnv:hover,
  .tnv--active {
    --tnv-idle: 1;
  }
  .tnv-track {
    position: relative;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none;
  }
  .tnv-track::-webkit-scrollbar {
    width: 0;
    height: 0;
  }
  /* Edge fade only while the rail actually scrolls, so a fitting rail never hides its first turn. */
  .tnv--overflow .tnv-track {
    -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 18px), transparent 100%);
    mask-image: linear-gradient(to bottom, transparent 0, black 18px, black calc(100% - 18px), transparent 100%);
  }
  /* Full-pitch transparent hit target: every y on the rail belongs to a turn, leaving no dead gaps. */
  .tnv-slot {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    cursor: pointer;
    /* Anchors the mark dot, and reserves the column it sits in so a marked
       line starts where an unmarked one does. */
    position: relative;
    padding-left: 7px;
  }
  .tnv-slot:focus-visible .tnv-line {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: 3px;
  }
  .tnv-line {
    height: 2px;
    border-radius: 999px;
    transform-origin: left center;
    width: calc((var(--tnv-base, 8) + var(--tnv-cur, 0) * 4 + var(--tnv-w, 0) * 12) * 1px);
    transform: scaleY(calc(1 + var(--tnv-w, 0) + var(--tnv-cur, 0) * 0.5));
    /* max() keeps the current turn fully opaque through the idle fade. */
    opacity: max(calc((0.34 + var(--tnv-w, 0) * 0.66) * var(--tnv-idle)), var(--tnv-cur, 0));
    background: color-mix(in srgb,
      var(--dsw-alias-label-primary) calc(var(--tnv-w, 0) * 100%),
      var(--dsw-alias-label-tertiary));
    transition:
      width 0.13s cubic-bezier(0.22, 0.61, 0.36, 1),
      transform 0.13s cubic-bezier(0.22, 0.61, 0.36, 1),
      opacity 0.16s ease,
      background-color 0.16s ease;
  }
  /* Reading position: the one persistent, chromatic mark on the rail. */
  .tnv-slot--current .tnv-line {
    background: var(--dsw-alias-state-business-primary);
    box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--dsw-alias-state-business-primary) 15%, transparent);
  }

  /*
   * Marked turn: the rail's THIRD channel, and it must not fight the other
   * two. The line keeps its own colour — repainting it would compete with the
   * reading position for the accent — so the mark is a dot in a separate
   * position and a separate hue (warn, i.e. "attention", not "error"). It also
   * ignores the idle fade: a mark the user has to hover to find would defeat
   * the point of marking it.
   */
  .tnv-slot--marked .tnv-line {
    opacity: 1;
  }
  .tnv-slot--marked::before {
    content: '';
    position: absolute;
    left: 0;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--dsw-alias-state-warn-primary);
  }
  /*
   * Mark label, in the gutter between the rail and the transcript column.
   * Fixed-positioned off the live slot rect (see markEls) so it follows the
   * track's own scrolling for free.
   */
  .tnv-mark {
    position: fixed;
    z-index: 49;
    transform: translateY(-50%);
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    /* Hit-testable, unlike the gutter around it: the label is the mark's other
       handle (click to jump, right-click to unmark). */
    pointer-events: auto;
    cursor: pointer;
    font-size: 11px;
    line-height: 16px;
    color: var(--dsw-alias-label-tertiary);
    transition: color 0.16s ease;
  }
  .tnv-mark:hover {
    color: var(--dsw-alias-label-primary);
  }
  .tnv-mark--current {
    color: var(--dsw-alias-label-secondary);
  }

  /*
   * Preview card. The surface matches the app's own hover card (#2C2C2E in both
   * themes, from ui-primitives HoverCard), so its foreground colors are
   * component constants rather than theme tokens — theme tokens would invert
   * against a surface that does not.
   */
  .tnv-card {
    --tnv-card-fg: #F9FAFB;
    --tnv-card-accent: #5686FE;
    position: fixed;
    z-index: 60;
    box-sizing: border-box;
    width: 300px;
    max-width: calc(100vw - 40px);
    padding: 11px 14px 12px;
    border-radius: 12px;
    background: color-mix(in srgb, #2C2C2E 94%, transparent);
    -webkit-backdrop-filter: blur(16px) saturate(1.2);
    backdrop-filter: blur(16px) saturate(1.2);
    box-shadow:
      0 16px 40px -12px rgba(0, 0, 0, 0.42),
      0 2px 8px -2px rgba(0, 0, 0, 0.24);
    color: var(--tnv-card-fg);
    pointer-events: none;
    animation: tnv-card-in 0.14s cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  @keyframes tnv-card-in {
    from {
      opacity: 0;
      transform: translateY(3px);
    }
  }
  .tnv-card-head {
    display: flex;
    align-items: baseline;
    gap: 5px;
    margin-bottom: 6px;
    font-variant-numeric: tabular-nums;
    font-size: 11px;
    line-height: 1;
  }
  .tnv-card-index {
    font-weight: 650;
    color: var(--tnv-card-accent);
  }
  .tnv-card-total {
    color: rgba(249, 250, 251, 0.42);
  }
  .tnv-card-size {
    margin-left: auto;
    color: rgba(249, 250, 251, 0.42);
  }
  .tnv-card-title {
    font-size: 13px;
    line-height: 1.45;
    font-weight: 600;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tnv-card-reply {
    margin-top: 7px;
    padding-top: 7px;
    border-top: 1px solid rgba(249, 250, 251, 0.12);
    font-size: 12px;
    line-height: 1.55;
    color: rgba(249, 250, 251, 0.62);
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tnv-card-placeholder {
    color: rgba(249, 250, 251, 0.38);
  }
  .tnv-card-hint {
    margin-top: 8px;
    padding-top: 7px;
    border-top: 1px solid rgba(249, 250, 251, 0.12);
    font-size: 11px;
    line-height: 1;
    color: rgba(249, 250, 251, 0.42);
  }

  @media (prefers-reduced-motion: reduce) {
    .tnv-line {
      transform: none;
      transition: none;
    }
    .tnv-card {
      animation: none;
    }
  }

  /*
   * Sidebar switch. Mirrors the Settings trigger row (ui-settings-general
   * SettingsRoot.module.css, .trigger and .trigger.rail) value for value so the
   * sidebar foot reads as one control group; the harness's class names are
   * hashed per build and cannot be targeted from here, so a restyle upstream
   * needs the same edit here.
   */
  /*
   * The sidebar foot lays its actions out in one nowrap flex row, so two
   * full-width rows would overlap instead of stacking. Matched by the CSS
   * module's local-name suffix because the harness hashes the prefix per build;
   * every plugin seating a full-width row there declares the same rule, which
   * is idempotent when more than one is installed.
   */
  [class*="_footerActions"] {
    flex-wrap: wrap;
  }
  .tnv-row {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    width: calc(100% + 8px);
    height: 34px;
    margin: 4px -4px 4px;
    padding: 6px 2px 6px 10px;
    box-sizing: border-box;
    border: none;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    color: var(--dsw-alias-label-primary);
    font-family: inherit;
    font-size: 14px;
    line-height: 22px;
  }
  .tnv-row:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
  .tnv-row:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: -2px;
  }
  /* Off: the row stays legible but recedes, so the state reads without a second control. */
  .tnv-row--off {
    color: var(--dsw-alias-label-tertiary);
  }
  .tnv-row--rail {
    width: 36px;
    height: 36px;
    margin: 8px 0 10px;
    justify-content: center;
    gap: 0;
    padding: 0;
    border-radius: 50%;
  }
  .tnv-row svg {
    flex: none;
    display: block;
  }
  .tnv-row-label {
    overflow: hidden;
    white-space: nowrap;
  }

  /*
   * Settings card. Copied value for value from ui-settings-plugins'
   * PluginCard.module.css and fields.module.css so this card and the shipped
   * three read as one stack; the harness hashes its class names per build and
   * they cannot be inherited from here, so a restyle upstream needs the same
   * edit here. The control is a bare native checkbox because that is what the
   * product itself uses (ModelListEditor) — a hand-drawn switch would be the
   * one inconsistent thing on the page.
   */
  .tnv-set-card {
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
  .tnv-set-card::before {
    content: '';
    position: absolute;
    left: 0;
    top: 14px;
    bottom: 14px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 45%, transparent);
  }
  .tnv-set-badge {
    flex: none;
    border-radius: 999px;
    padding: 1px 8px;
    font-size: 11px;
    line-height: 17px;
    font-weight: 500;
    white-space: nowrap;
    /* Tinted, not the platform grey the shipped "unsaved" pill uses: the two
       can sit side by side and must not read as the same kind of statement. */
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);
    color: var(--dsw-alias-state-business-primary);
  }
  .tnv-set-card:hover {
    border-color: var(--dsw-alias-label-dimmed);
  }
  /* An open card reads as the one being worked on, not merely taller. */
  .tnv-set-card--open {
    background: var(--dsw-alias-bg-layer-2);
    border-color: var(--dsw-alias-label-dimmed);
  }
  .tnv-set-header {
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
  .tnv-set-header:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -2px;
  }
  .tnv-set-headText {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .tnv-set-name {
    font-size: 15px;
    font-weight: 600;
    line-height: 1.4;
    color: var(--dsw-alias-label-primary);
  }
  .tnv-set-desc {
    font-size: 13px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .tnv-set-chevron {
    flex: none;
    color: var(--dsw-alias-label-tertiary);
    transition: transform .16s;
  }
  .tnv-set-chevron--open {
    transform: rotate(180deg);
  }
  .tnv-set-body {
    border-top: 1px solid var(--dsw-alias-border-l2);
    margin: 0 16px;
    padding-bottom: 8px;
  }
  .tnv-set-readOnly {
    margin: 12px 0 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  .tnv-set-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 12px 0;
  }
  .tnv-set-fieldHead {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tnv-set-label {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--dsw-alias-label-primary);
  }
  /* Field-level note, for a switch whose consequence is not obvious from its
     label. Matches the shipped card-description type.
     (No backticks anywhere in this literal — they would end it.) */
  .tnv-set-hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--dsw-alias-label-tertiary);
  }
  /* Geometry follows the shipped text input (fields.module.css .input). */
  .tnv-set-select {
    height: 34px;
    padding: 0 8px;
    border: 1px solid var(--dsw-alias-border-l2);
    border-radius: 8px;
    background: var(--dsw-alias-bg-layer-3);
    color: var(--dsw-alias-label-primary);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .tnv-set-select:focus-visible {
    outline: 2px solid var(--dsw-alias-brand-primary);
    outline-offset: -1px;
  }
  .tnv-set-select:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .tnv-set-field + .tnv-set-field {
    border-top: 1px solid var(--dsw-alias-border-l2);
  }
`;
		/**
		* Narrow one field off a wire section, keeping the last good value when the
		* Host does not carry it or carries something else. See the sync below for why
		* a missing field is expected rather than exceptional.
		* @param raw - the field as the Host sent it.
		* @param fallback - the value to keep.
		* @returns the field, or the fallback.
		*/
		function pickBoolean(raw, fallback) {
			return typeof raw === "boolean" ? raw : fallback;
		}
		/** {@link pickBoolean} for a finite number. */
		function pickNumber(raw, fallback) {
			return typeof raw === "number" && Number.isFinite(raw) ? raw : fallback;
		}
		/**
		* Lengths the card's select offers: the presets, plus the stored value when a
		* hand-edited section holds one the presets do not cover, so editing the file
		* directly is not silently undone by opening the card.
		* @param current - the stored length.
		* @returns the option values, ascending.
		*/
		function labelCharOptions(current) {
			const presets = MARK_LABEL_PRESETS;
			return presets.includes(current) ? [...presets] : [...presets, current].sort((a, b) => a - b);
		}
		/**
		* The rail's preferences, mirrored locally over the durable settings section.
		*
		* A local mirror rather than reads straight off the scope: the consumers (rail,
		* sidebar switch, settings card) render synchronously and the scope's first
		* value arrives asynchronously, so the mirror is what lets activation proceed
		* at the schema defaults and adopt the stored choice when it lands. Without a
		* settings provider composed, the mirror is simply never attached and a toggle
		* applies for the session only.
		*/
		function createRailStore() {
			const listeners = /* @__PURE__ */ new Set();
			let value = { ...DEFAULT_CONFIG };
			let status = {
				phase: "unavailable",
				writable: false
			};
			let write;
			const notify = () => {
				for (const listener of listeners) listener();
			};
			return {
				get: () => value,
				status: () => status,
				toggle: (field) => {
					const next = !value[field];
					value = {
						...value,
						[field]: next
					};
					notify();
					write?.(field, next);
				},
				set: (field, next) => {
					if (value[field] === next) return;
					value = {
						...value,
						[field]: next
					};
					notify();
					write?.(field, next);
				},
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				attach: (scope) => {
					write = (field, next) => {
						scope.set(field, next).catch(() => {});
					};
					const sync = () => {
						const snapshot = scope.getSnapshot();
						const section = snapshot.value;
						const nextStatus = {
							phase: snapshot.status,
							writable: snapshot.writable === true && snapshot.status === "ready"
						};
						const nextValue = section === void 0 ? value : {
							visible: pickBoolean(section.visible, value.visible),
							sidebarToggle: pickBoolean(section.sidebarToggle, value.sidebarToggle),
							markLabelChars: pickNumber(section.markLabelChars, value.markLabelChars)
						};
						if (!(nextValue.visible !== value.visible || nextValue.sidebarToggle !== value.sidebarToggle || nextValue.markLabelChars !== value.markLabelChars || nextStatus.phase !== status.phase || nextStatus.writable !== status.writable)) return;
						value = nextValue;
						status = nextStatus;
						notify();
					};
					sync();
					const off = scope.subscribe(sync);
					return () => {
						off();
						write = void 0;
						status = {
							phase: "unavailable",
							writable: false
						};
						notify();
					};
				}
			};
		}
		/** Subscribe a component to the preference store. */
		function useRailSettings(store) {
			const [value, setValue] = react.useState(store.get);
			react.useEffect(() => store.subscribe(() => setValue(store.get())), [store]);
			return value;
		}
		/** Extract text from a block list (accepts both ContentBlock and AssistantBlock shapes). */
		function textOfBlocks(content) {
			return (Array.isArray(content) ? content : []).filter((b) => b && (b.type === "text" || b.kind === "text") && typeof b.text === "string").map((b) => b.text).join("\n").replace(/\s+/g, " ").trim();
		}
		/** Group chat nodes into turns: a user node opens a turn; the turn-tail closing assistant fills the reply. */
		function buildTurns(snap) {
			const chat = snap && snap.chat;
			if (!chat || !chat.order || !chat.nodes) return [];
			const turns = [];
			let current = null;
			for (const key of chat.order) {
				const node = chat.nodes.get(key);
				if (!node) continue;
				if (node.kind === "user") {
					current = {
						key,
						title: textOfBlocks(node.data && node.data.content),
						reply: "",
						size: 1
					};
					turns.push(current);
					continue;
				}
				if (!current) continue;
				current.size++;
				if (node.kind === "turn-tail") {
					const closing = node.data && node.data.closing;
					if (closing && closing.finalNode) {
						const reply = textOfBlocks(closing.finalNode.blocks);
						if (reply) current.reply = reply;
					}
				} else if (node.kind === "assistant-step") {
					const data = node.data;
					if (data && data.status === "settled" && data.blocks) {
						const reply = textOfBlocks(data.blocks);
						if (reply) current.reply = reply;
					}
				}
			}
			return turns;
		}
		/** Resting line length in px: log-scaled node count, so a heavy turn reads long without dwarfing the rest. */
		function restingLength(size) {
			const ratio = Math.log(Math.max(1, size)) / Math.log(LEN_SATURATION);
			return LEN_BASE + LEN_SPAN * Math.min(1, ratio);
		}
		/** Subscribe to an ObservableSnapshot with plain state/effect (no uSES dependency). */
		function useObservable(store) {
			const [snap, setSnap] = react.useState(() => store ? store.getSnapshot() : void 0);
			react.useEffect(() => {
				if (!store) return void 0;
				setSnap(store.getSnapshot());
				return store.subscribe(() => setSnap(store.getSnapshot()));
			}, [store]);
			return snap;
		}
		/** Measure the conversation scrollport rect (geometry for the fixed rail). */
		function useConversationGeometry(currentId) {
			const [geom, setGeom] = react.useState(null);
			react.useEffect(() => {
				if (!currentId) return void 0;
				const el = document.querySelector("[data-conversation-scroll]");
				if (!el) return void 0;
				const measure = () => {
					const r = el.getBoundingClientRect();
					if (r.width > 0) setGeom({
						left: r.left,
						top: r.top,
						height: r.height
					});
				};
				measure();
				const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
				if (ro) ro.observe(el);
				window.addEventListener("resize", measure);
				return () => {
					if (ro) ro.disconnect();
					window.removeEventListener("resize", measure);
				};
			}, [currentId]);
			return geom;
		}
		/**
		* Scroll linkage: reveal the rail while scrolling, move the wave peak with the
		* reading position, and mark the current turn index. The current index survives
		* the debounce so the marker stays after scrolling stops.
		*
		* The anchor map and the painter are read through refs because both change on
		* every snapshot while this subscription is keyed only to the session.
		* `pointerPeakRef` holds the pointer's wave peak, or null when the pointer is
		* off the rail: settling hands the wave back to it rather than clearing a wave
		* the pointer is still driving.
		*
		* `pinRef` carries the clicked turn across that click's smooth scroll:
		* `{ index, safety }`, where `index` is the pinned turn (null when unpinned) and
		* `safety` disposes the timer that unpins a click which scrolled nothing.
		*/
		function useScrollReveal(ctx, currentId, keyToIndexRef, turnCountRef, paintRef, pointerPeakRef, pinRef, railElRef) {
			const [currentIndex, setCurrentIndex] = react.useState(0);
			react.useEffect(() => {
				if (!currentId) return void 0;
				const el = document.querySelector("[data-conversation-scroll]");
				if (!el) return void 0;
				let debounce = null;
				let raf = null;
				/**
				* Turn the reader is on: the turn owning the first anchor at or below the
				* scrollport top. At the end of the scroll range no anchor can reach the top
				* — the scrollport has nothing left to scroll — so the last turn is the
				* answer there regardless of which anchor sits under the top edge.
				*/
				const readingIndex = (scrollport) => {
					const last = Math.max(0, turnCountRef.current - 1);
					if (scrollport.scrollTop >= scrollport.scrollHeight - scrollport.clientHeight - BOTTOM_EPSILON) return last;
					const top = scrollport.getBoundingClientRect().top;
					for (const a of Array.from(scrollport.querySelectorAll("[data-chat-anchor-key]"))) if (a.getBoundingClientRect().top >= top - 2) {
						const idx = keyToIndexRef.current.get(a.getAttribute("data-chat-anchor-key"));
						if (idx !== void 0) return idx;
					}
					return last;
				};
				const update = () => {
					raf = null;
					const railEl = railElRef.current;
					if (railEl) railEl.classList.add("tnv--active");
					if (pinRef.safety) {
						pinRef.safety();
						pinRef.safety = null;
					}
					const index = pinRef.index !== null ? pinRef.index : readingIndex(el);
					setCurrentIndex(index);
					paintRef.current(index);
					if (debounce) debounce();
					debounce = ctx.timeout(() => {
						pinRef.index = null;
						if (railElRef.current) railElRef.current.classList.remove("tnv--active");
						paintRef.current(pointerPeakRef.current);
					}, SCROLL_REST_MS);
				};
				const onScroll = () => {
					if (raf === null) raf = requestAnimationFrame(update);
				};
				el.addEventListener("scroll", onScroll, { passive: true });
				return () => {
					el.removeEventListener("scroll", onScroll);
					if (raf !== null) cancelAnimationFrame(raf);
					if (debounce) debounce();
				};
			}, [currentId]);
			return {
				currentIndex,
				setCurrentIndex
			};
		}
		/**
		* Client plugin body: register the rail into the frame-wide overlay and own
		* the injected stylesheet for the plugin's lifetime. The component is defined
		* here so it closes over this plugin's ctx.
		*/
		function apply(ctx) {
			const styleEl = document.createElement("style");
			styleEl.textContent = CSS;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => {
				styleEl.remove();
			});
			const railStore = createRailStore();
			const markStore = createMarkStore();
			ctx.inject([
				"settingsScope",
				"connection",
				"remote"
			], (settingsCtx) => {
				settingsCtx.effect(() => railStore.attach(settingsCtx.settingsScope.bind({ namespace: TURN_NAV_NAMESPACE })), "turn-nav: preference section");
			});
			/**
			* The sidebar-foot switch that shows and hides the rail — itself optional,
			* so a user who sets the rail once can reclaim the row. Returning null rather
			* than skipping registration keeps one registration for the plugin's life:
			* the seat is claimed at activation and the preference decides only what it
			* draws, which is also what lets the settings card put the row back without
			* a re-registration round trip.
			*/
			function RailToggle(props) {
				const { visible, sidebarToggle } = useRailSettings(railStore);
				if (!sidebarToggle) return null;
				const wide = props.wide !== false;
				const action = visible ? "隐藏快捷导航" : "显示快捷导航";
				return react.createElement("button", {
					type: "button",
					className: "tnv-row" + (wide ? "" : " tnv-row--rail") + (visible ? "" : " tnv-row--off"),
					title: action,
					"aria-label": action,
					"aria-pressed": visible ? "true" : "false",
					onClick: () => railStore.toggle("visible")
				}, react.createElement(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, { size: 16 }), wide ? react.createElement("span", { className: "tnv-row-label" }, "快捷导航") : null);
			}
			/**
			* The plugin's card in Settings → Plugins. It edits the same store the
			* sidebar switch does, so the two never disagree.
			*
			* The card draws its own internals — its slot contract says so, and this
			* bundle could not import the shipped card components anyway, they are
			* outside the shell's frozen module table. Structure and tokens therefore
			* mirror ui-settings-plugins' `PluginCard` (a list item whose header
			* discloses the controls in place) so the four cards read as one stack; a
			* restyle upstream needs the same edit here.
			*
			* One deliberate departure: no staged edits and no save footer. The shipped
			* cards stage because they edit text and numbers, where writing per
			* keystroke would be wrong; a single switch over a `live` section is the
			* product's own immediate-apply preference pattern, and making the user
			* confirm twice to hide a rail would be worse, not more consistent.
			*/
			function RailSettingsCard() {
				const [open, setOpen] = react.useState(false);
				const settingsValue = useRailSettings(railStore);
				const [status, setStatus] = react.useState(railStore.status);
				react.useEffect(() => railStore.subscribe(() => setStatus(railStore.status())), []);
				const visibleId = react.useId();
				const toggleId = react.useId();
				const labelCharsId = react.useId();
				/** One boolean row, matching the shipped field geometry. */
				const field = (id, label, field, hint) => react.createElement("div", {
					className: "tnv-set-field",
					key: field
				}, react.createElement("div", { className: "tnv-set-fieldHead" }, react.createElement("label", {
					className: "tnv-set-label",
					htmlFor: id
				}, label), react.createElement("input", {
					id,
					type: "checkbox",
					checked: settingsValue[field],
					disabled: !status.writable,
					onChange: () => {
						railStore.toggle(field);
					}
				})), hint === void 0 ? null : react.createElement("p", { className: "tnv-set-hint" }, hint));
				if (status.phase === "unavailable") return null;
				return react.createElement("li", { className: "tnv-set-card" + (open ? " tnv-set-card--open" : "") }, react.createElement("button", {
					type: "button",
					className: "tnv-set-header",
					"aria-expanded": open,
					"aria-label": (open ? "收起" : "展开") + "：快捷导航",
					onClick: () => {
						setOpen(!open);
					}
				}, react.createElement("span", { className: "tnv-set-headText" }, react.createElement("span", { className: "tnv-set-name" }, "快捷导航"), react.createElement("span", { className: "tnv-set-desc" }, "对话区左缘的轮次导航条。")), react.createElement("span", { className: "tnv-set-badge" }, "自定义"), react.createElement(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, { className: "tnv-set-chevron" + (open ? " tnv-set-chevron--open" : "") })), open ? react.createElement("div", { className: "tnv-set-body" }, status.phase === "ready" && !status.writable ? react.createElement("p", {
					className: "tnv-set-readOnly",
					role: "status"
				}, "配置文件当前不可写。") : null, field(visibleId, "显示导航条", "visible"), field(toggleId, "在侧边栏显示开关", "sidebarToggle", "关掉之后，这张卡片是改回来的唯一入口。"), react.createElement("div", {
					className: "tnv-set-field",
					key: "markLabelChars"
				}, react.createElement("div", { className: "tnv-set-fieldHead" }, react.createElement("label", {
					className: "tnv-set-label",
					htmlFor: labelCharsId
				}, "标记标题字数"), react.createElement("select", {
					id: labelCharsId,
					className: "tnv-set-select",
					value: String(settingsValue.markLabelChars),
					disabled: !status.writable,
					onChange: (event) => {
						railStore.set("markLabelChars", Number(event.target.value));
					}
				}, ...labelCharOptions(settingsValue.markLabelChars).map((n) => react.createElement("option", {
					key: n,
					value: String(n)
				}, n + " 字")))), react.createElement("p", { className: "tnv-set-hint" }, "导航条与正文列之间的空间也会截断标签，窗口窄时设大了也看不全。"))) : null);
			}
			/** The rail component (created once per activation, so hook state is stable). */
			function TurnNav(props) {
				const settings = useRailSettings(railStore);
				const visible = settings.visible;
				const railRef = react.useRef(null);
				const trackRef = react.useRef(null);
				const slotRefs = react.useRef([]);
				const cardRef = react.useRef(null);
				const currentId = props.useSessions((s) => s.current);
				const binding = currentId ? ctx.sessions.binding(currentId) : void 0;
				const snap = useObservable(binding && binding.session);
				const turns = react.useMemo(() => buildTurns(snap), [snap]);
				const keyToIndex = react.useMemo(() => {
					const m = /* @__PURE__ */ new Map();
					const chat = snap && snap.chat;
					let idx = -1;
					if (chat && chat.order && chat.nodes) for (const key of chat.order) {
						const node = chat.nodes.get(key);
						if (!node) continue;
						if (node.kind === "user") idx++;
						if (idx >= 0) m.set(key, idx);
					}
					return m;
				}, [snap]);
				const keyToIndexRef = react.useRef(keyToIndex);
				keyToIndexRef.current = keyToIndex;
				const geom = useConversationGeometry(currentId);
				const [hoverIndex, setHoverIndex] = react.useState(-1);
				const [markVersion, setMarkVersion] = react.useState(0);
				react.useEffect(() => markStore.subscribe(() => {
					setMarkVersion((v) => v + 1);
				}), []);
				const marks = react.useMemo(() => currentId ? markStore.get(currentId) : /* @__PURE__ */ new Set(), [currentId, markVersion]);
				const sessionIds = props.useSessions((s) => s.ids);
				react.useEffect(() => {
					if (Array.isArray(sessionIds)) markStore.prune(sessionIds);
				}, [sessionIds]);
				const [overflow, setOverflow] = react.useState(false);
				const railHeight = geom ? Math.max(120, geom.height - 140) : 0;
				const step = Math.max(STEP_MIN, Math.min(STEP_MAX, railHeight / Math.max(1, turns.length)));
				/**
				* Write the wave weight of every line for one peak position, expressed in
				* fractional turn indices (null clears the wave). Bypassing React keeps
				* pointer tracking to one custom-property write per line per frame.
				*/
				const paint = (peak) => {
					const slots = slotRefs.current;
					for (let i = 0; i < slots.length; i++) {
						const el = slots[i];
						if (!el) continue;
						const w = peak === null ? 0 : Math.max(0, 1 - Math.abs(peak - i) / FALLOFF_STEPS);
						el.firstChild.style.setProperty("--tnv-w", w.toFixed(3));
					}
				};
				const paintRef = react.useRef(paint);
				paintRef.current = paint;
				const pointerPeakRef = react.useRef(null);
				const pinRef = react.useRef({
					index: null,
					safety: null
				}).current;
				const turnCountRef = react.useRef(turns.length);
				turnCountRef.current = turns.length;
				const { currentIndex, setCurrentIndex } = useScrollReveal(ctx, currentId, keyToIndexRef, turnCountRef, paintRef, pointerPeakRef, pinRef, railRef);
				react.useEffect(() => {
					if (!binding || !snap || !snap.hasMore) return void 0;
					binding.session.loadOlder().catch(() => {});
				}, [snap]);
				const pointerRaf = react.useRef(null);
				const pointerY = react.useRef(0);
				react.useEffect(() => () => {
					if (pointerRaf.current !== null) cancelAnimationFrame(pointerRaf.current);
					if (pinRef.safety) pinRef.safety();
				}, []);
				react.useLayoutEffect(() => {
					const track = trackRef.current;
					const slot = slotRefs.current[currentIndex];
					if (!track || !slot) return;
					const scrollable = track.scrollHeight > track.clientHeight + 1;
					setOverflow(scrollable);
					if (!scrollable) return;
					const top = slot.offsetTop;
					const bottom = top + slot.offsetHeight;
					if (top < track.scrollTop + TRACK_REVEAL_MARGIN) track.scrollTop = Math.max(0, top - TRACK_REVEAL_MARGIN);
					else if (bottom > track.scrollTop + track.clientHeight - TRACK_REVEAL_MARGIN) track.scrollTop = bottom - track.clientHeight + TRACK_REVEAL_MARGIN;
				}, [
					currentIndex,
					turns.length,
					step,
					railHeight
				]);
				react.useLayoutEffect(() => {
					const card = cardRef.current;
					const slot = slotRefs.current[hoverIndex];
					const rail = railRef.current;
					if (!card || !slot || !rail) return;
					const slotRect = slot.getBoundingClientRect();
					const railRect = rail.getBoundingClientRect();
					const width = card.offsetWidth;
					const height = card.offsetHeight;
					let x = railRect.right + CARD_GAP;
					if (x + width > window.innerWidth - CARD_MARGIN) x = railRect.left - CARD_GAP - width;
					const y = slotRect.top + slotRect.height / 2 - height / 2;
					card.style.left = Math.max(CARD_MARGIN, x) + "px";
					card.style.top = Math.max(CARD_MARGIN, Math.min(window.innerHeight - CARD_MARGIN - height, y)) + "px";
					card.style.visibility = "visible";
				}, [hoverIndex]);
				if (!visible || !geom || turns.length === 0) return react.createElement("div", null);
				const jumpTo = (key, index) => {
					setCurrentIndex(index);
					paint(index);
					pinRef.index = index;
					if (pinRef.safety) pinRef.safety();
					pinRef.safety = ctx.timeout(() => {
						pinRef.index = null;
						pinRef.safety = null;
					}, PIN_SAFETY_MS);
					const nodes = document.querySelectorAll("[data-chat-anchor-key]");
					for (const el of nodes) if (el.getAttribute("data-chat-anchor-key") === key) {
						el.scrollIntoView({
							behavior: "smooth",
							block: "start"
						});
						break;
					}
				};
				const onTrackMove = (ev) => {
					const track = trackRef.current;
					if (!track) return;
					const r = track.getBoundingClientRect();
					pointerY.current = ev.clientY - r.top + track.scrollTop;
					if (pointerRaf.current !== null) return;
					pointerRaf.current = requestAnimationFrame(() => {
						pointerRaf.current = null;
						pointerPeakRef.current = pointerY.current / step - .5;
						paintRef.current(pointerPeakRef.current);
					});
				};
				const slotEls = turns.map((turn, i) => {
					const isCurrent = i === currentIndex;
					const isMarked = marks.has(turn.key);
					const line = react.createElement("div", {
						className: "tnv-line",
						style: {
							"--tnv-base": restingLength(turn.size).toFixed(1),
							"--tnv-cur": isCurrent ? "1" : "0"
						}
					});
					return react.createElement("button", {
						key: turn.key,
						type: "button",
						className: "tnv-slot" + (isCurrent ? " tnv-slot--current" : "") + (isMarked ? " tnv-slot--marked" : ""),
						style: { height: step + "px" },
						ref: (el) => {
							slotRefs.current[i] = el;
						},
						"aria-label": "第 " + (i + 1) + " 轮：" + (turn.title || "（空消息）") + (isMarked ? "（已标记）" : ""),
						"aria-current": isCurrent ? "true" : void 0,
						"aria-pressed": isMarked ? "true" : void 0,
						onMouseEnter: () => setHoverIndex(i),
						onFocus: () => setHoverIndex(i),
						onClick: () => jumpTo(turn.key, i),
						onContextMenu: (event) => {
							event.preventDefault();
							if (currentId) markStore.toggle(currentId, turn.key);
						},
						onKeyDown: (event) => {
							if (event.key !== "m" && event.key !== "M") return;
							event.preventDefault();
							if (currentId) markStore.toggle(currentId, turn.key);
						}
					}, line);
				});
				slotRefs.current.length = turns.length;
				const markEls = marks.size === 0 ? null : (() => {
					const column = document.querySelector("[data-chat-anchor-key]");
					if (column === null) return null;
					const labelRoom = column.getBoundingClientRect().left - (geom.left + 10 + RAIL_WIDTH) - LABEL_GAP;
					if (labelRoom < LABEL_MIN_WIDTH) return null;
					return turns.flatMap((turn, i) => {
						if (!marks.has(turn.key)) return [];
						const slot = slotRefs.current[i];
						if (!slot) return [];
						const rect = slot.getBoundingClientRect();
						if (rect.bottom < geom.top || rect.top > geom.top + railHeight) return [];
						const full = turn.title || "（空消息）";
						const label = [...full].length <= settings.markLabelChars ? full : [...full].slice(0, settings.markLabelChars).join("") + "…";
						return [react.createElement("span", {
							key: turn.key,
							className: "tnv-mark" + (i === currentIndex ? " tnv-mark--current" : ""),
							title: full,
							style: {
								top: rect.top + rect.height / 2,
								left: geom.left + 10 + RAIL_WIDTH + LABEL_GAP,
								maxWidth: Math.min(labelRoom, LABEL_MAX_WIDTH)
							},
							onClick: () => jumpTo(turn.key, i),
							onContextMenu: (event) => {
								event.preventDefault();
								if (currentId) markStore.toggle(currentId, turn.key);
							}
						}, label)];
					});
				})();
				const hovered = hoverIndex >= 0 && hoverIndex < turns.length ? turns[hoverIndex] : null;
				const cardEl = hovered ? react.createElement("div", {
					className: "tnv-card",
					ref: cardRef,
					style: {
						visibility: "hidden",
						left: 0,
						top: 0
					}
				}, react.createElement("div", { className: "tnv-card-head" }, react.createElement("span", { className: "tnv-card-index" }, String(hoverIndex + 1)), react.createElement("span", { className: "tnv-card-total" }, "/ " + turns.length), hovered.size > 1 ? react.createElement("span", { className: "tnv-card-size" }, hovered.size + " 步") : null), react.createElement("div", { className: "tnv-card-title" }, hovered.title || react.createElement("span", { className: "tnv-card-placeholder" }, "（空消息）")), react.createElement("div", { className: "tnv-card-reply" }, hovered.reply || react.createElement("span", { className: "tnv-card-placeholder" }, "（回复中…）")), react.createElement("div", { className: "tnv-card-hint" }, marks.has(hovered.key) ? "右键取消标记" : "右键标记")) : null;
				return react.createElement("div", {
					className: "tnv" + (overflow ? " tnv--overflow" : ""),
					ref: railRef,
					role: "navigation",
					"aria-label": "对话轮次导航",
					style: {
						left: geom.left + 10,
						top: geom.top + 20,
						height: railHeight
					}
				}, react.createElement("div", {
					className: "tnv-track",
					ref: trackRef,
					onScroll: marks.size === 0 ? void 0 : () => {
						setMarkVersion((v) => v + 1);
					},
					onMouseMove: onTrackMove,
					onMouseLeave: () => {
						setHoverIndex(-1);
						pointerPeakRef.current = null;
						paint(null);
					}
				}, slotEls), markEls, cardEl);
			}
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "turn-nav"
			}, (props) => react.createElement(TurnNav, props)));
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "turn-nav-toggle",
				order: TOGGLE_SLOT_ORDER
			}, (props) => react.createElement(RailToggle, props)));
			ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
				name: "settings.plugin.item",
				key: TURN_NAV_NAMESPACE
			}, () => react.createElement(RailSettingsCard)));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map