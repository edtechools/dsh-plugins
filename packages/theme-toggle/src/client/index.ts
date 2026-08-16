/**
 * Theme toggle plugin, browser half: a compact light/dark switch in the sidebar
 * foot, beside Settings.
 *
 * The theme is read and written through the `theme` service the harness's
 * ui-theme plugin provides — a cordis service, never a value import, so this
 * bundle stays free of any specifier the shell's frozen module table cannot
 * answer. `setTheme` is the product's own preference write path, so the switch
 * persists exactly like the Appearance row in Settings and both stay in sync.
 *
 * The product preference has three values (`light` / `dark` / `system`) while a
 * switch has two. This toggles against the *resolved* scheme rather than the
 * stored preference: whatever you are currently looking at, one click gives you
 * the other. A click therefore always leaves `system`, which the Appearance row
 * in Settings remains the way back to.
 */

import * as React from 'react'

export const inject = ['slots', 'theme']

/** Slot order: sits above Settings, right-aligned, ahead of any later action. */
const SLOT_ORDER = 10

const CSS = `
  .tt-btn {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    cursor: pointer;
    color: var(--dsw-alias-label-secondary);
    transition: background-color 0.15s ease, color 0.15s ease;
  }
  .tt-btn:hover {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-label-primary);
  }
  .tt-btn:focus-visible {
    outline: 2px solid var(--dsw-alias-state-business-primary);
    outline-offset: 2px;
  }
  .tt-btn svg {
    width: 16px;
    height: 16px;
    display: block;
  }
  /* Wide column: hug the right edge, away from the Settings label. */
  .tt-row {
    display: flex;
    width: 100%;
    padding: 2px 8px;
    justify-content: flex-end;
  }
  .tt-row--rail {
    justify-content: center;
    padding: 2px 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .tt-btn { transition: none; }
  }
`

/** Sun mark, shown while the light scheme is active. */
function sunIcon(): React.ReactElement {
  return React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    React.createElement('circle', { cx: 8, cy: 8, r: 3.25, stroke: 'currentColor', strokeWidth: 1.4 }),
    ...[0, 45, 90, 135, 180, 225, 270, 315].map((deg) =>
      React.createElement('line', {
        key: deg,
        x1: 8, y1: 1.4, x2: 8, y2: 3,
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        transform: `rotate(${deg} 8 8)`,
      })),
  )
}

/** Crescent mark, shown while the dark scheme is active. */
function moonIcon(): React.ReactElement {
  return React.createElement('svg', { viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': 'true' },
    React.createElement('path', {
      d: 'M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z',
      stroke: 'currentColor',
      strokeWidth: 1.4,
      strokeLinejoin: 'round',
    }),
  )
}

/**
 * Client plugin body: own the injected stylesheet for the plugin's lifetime and
 * seat the switch in the sidebar foot.
 */
export function apply(ctx: any): void {
  const styleEl = document.createElement('style')
  styleEl.textContent = CSS
  document.head.appendChild(styleEl)
  ctx.effect(() => () => {
    styleEl.remove()
  })

  /** The switch (created once per activation, so hook state is stable). */
  function ThemeToggle(props: any): React.ReactElement {
    const [snapshot, setSnapshot] = React.useState<any>(() => ctx.theme.getTheme())
    // The service is the single source of truth: a change from the Appearance
    // row in Settings reaches this switch through the same event.
    React.useEffect(() => ctx.on('theme/change', (next: any) => setSnapshot(next)), [])

    const isDark = snapshot.active.colorScheme === 'dark'
    const label = isDark ? '切换到浅色' : '切换到深色'
    return React.createElement('div', { className: 'tt-row' + (props.wide === false ? ' tt-row--rail' : '') },
      React.createElement('button', {
        type: 'button',
        className: 'tt-btn',
        title: label,
        'aria-label': label,
        onClick: () => ctx.theme.setTheme(isDark ? 'light' : 'dark'),
      }, isDark ? moonIcon() : sunIcon()),
    )
  }

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'theme-toggle', order: SLOT_ORDER },
    (props: any) => React.createElement(ThemeToggle, props),
  ))
}
