window.__ModuleLoader__.load({
	id: "dsh-plugin-theme-toggle",
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
		//#region src/client/index.ts
		/**
		* Theme toggle plugin, browser half: a compact light/dark switch in the sidebar
		* foot, beside Settings.
		*
		* The theme is read and written through the `theme` service the harness's
		* ui-theme plugin provides. Reaching another plugin through a cordis service
		* rather than importing its module is what keeps this bundle free of any
		* specifier the shell's frozen module table cannot answer; the one value import
		* here, the icon set, is itself a platform module and stays external.
		* `setTheme` is the product's own preference write path, so the switch persists
		* exactly like the Appearance row in Settings and both stay in sync.
		*
		* The product preference has three values (`light` / `dark` / `system`) while a
		* switch has two. This toggles against the *resolved* scheme rather than the
		* stored preference: whatever you are currently looking at, one click gives you
		* the other. A click therefore always leaves `system`, which the Appearance row
		* in Settings remains the way back to.
		*/
		const inject = ["slots", "theme"];
		/** Slot order: the sidebar foot renders actions above Settings, this one first. */
		const SLOT_ORDER = 10;
		const CSS = `
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
  .tt-btn {
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
  .tt-btn:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
  .tt-btn:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: -2px;
  }
  /* Rail trigger: the same 36x36 circle box as the other rail controls. */
  .tt-btn--rail {
    width: 36px;
    height: 36px;
    margin: 8px 0 10px;
    justify-content: center;
    gap: 0;
    padding: 0;
    border-radius: 50%;
  }
  .tt-btn svg {
    flex: none;
    width: 16px;
    height: 16px;
    display: block;
  }
  .tt-label {
    overflow: hidden;
    white-space: nowrap;
  }
`;
		/**
		* Client plugin body: own the injected stylesheet for the plugin's lifetime and
		* seat the switch in the sidebar foot.
		*/
		function apply(ctx) {
			const styleEl = document.createElement("style");
			styleEl.textContent = CSS;
			document.head.appendChild(styleEl);
			ctx.effect(() => () => {
				styleEl.remove();
			});
			/** The switch (created once per activation, so hook state is stable). */
			function ThemeToggle(props) {
				const [snapshot, setSnapshot] = react.useState(() => ctx.theme.getTheme());
				react.useEffect(() => ctx.on("theme/change", (next) => setSnapshot(next)), []);
				const isDark = snapshot.active.colorScheme === "dark";
				const wide = props.wide !== false;
				const label = isDark ? "浅色模式" : "深色模式";
				const action = isDark ? "切换到浅色模式" : "切换到深色模式";
				return react.createElement("button", {
					type: "button",
					className: "tt-btn" + (wide ? "" : " tt-btn--rail"),
					title: action,
					"aria-label": action,
					onClick: () => ctx.theme.setTheme(isDark ? "light" : "dark")
				}, react.createElement(isDark ? _deepseek_ai_dsh_client_ui_primitives.IconLightOutline16 : _deepseek_ai_dsh_client_ui_primitives.IconDarkOutline16, { size: 16 }), wide ? react.createElement("span", { className: "tt-label" }, label) : null);
			}
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "theme-toggle",
				order: SLOT_ORDER
			}, (props) => react.createElement(ThemeToggle, props)));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map