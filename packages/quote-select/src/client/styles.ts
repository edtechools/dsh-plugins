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

export const CSS = `
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
`
