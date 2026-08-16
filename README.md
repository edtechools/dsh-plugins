# dsh-plugins

Out-of-tree plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Nothing here lives in the harness checkout, so `git pull` on the harness never conflicts with this work.

| Package | Faces | What it does |
|---|---|---|
| [`packages/turn-nav`](packages/turn-nav) | node + browser | Conversation turn navigation rail at the left edge of the chat |
| [`packages/web-search`](packages/web-search) | node | `bocha_web_search` tool over the Bocha (博查) search API |

## Install into a profile

Each package is a **bundle** (`dsh.bundle.patch` in its manifest), so `dsh` installs it and appends its layer to the profile itself:

```sh
pnpm install && pnpm -r build
dsh plugin --profile web add ./packages/turn-nav ./packages/web-search
dsh --profile web --dump-config    # one labelled layer per bundle
```

`dsh plugin --profile web remove dsh-plugin-turn-nav` removes both the dependency and its layer. The profile's own `cordis.patch.yml` stays `[]` and is reserved for machine-local overrides of an installed row.

## Adding a plugin

1. `packages/<name>/` with `package.json` (`dsh.bundle.patch`, plus `dsh.client` if it has a browser half), `cordis.patch.yml`, `tsdown.config.ts`, `src/`.
2. `pnpm install && pnpm -r build`
3. `dsh plugin --profile web add ./packages/<name>`

Copy the closest existing package rather than starting from scratch — the two build configs encode constraints that are not obvious.

## Two constraints that will bite you

### Importing a harness package needs a `link:` devDependency

The harness maintains a flat fallback directory at `$DSH_HOME/profiles/node_modules` so bare plugin names resolve. **That fallback is unreachable from here.** `dsh plugin add ./packages/x` records a `link:`, so the package's real path stays under this repository, and Node's parent-directory walk from the real path never reaches `$DSH_HOME/profiles/`.

A plugin importing nothing (`turn-nav`'s node half) is unaffected. A plugin importing `@deepseek-ai/dsh-tools` or any other Service Definition fails at load with `ERR_MODULE_NOT_FOUND`. The fix is a `link:` devDependency beside the peer dependency, pointing at the harness checkout:

```json
"peerDependencies": { "@deepseek-ai/dsh-tools": "*" },
"devDependencies": { "@deepseek-ai/dsh-tools": "link:../../../deepseek-harness/packages/core/tools" }
```

This resolves to the same physical package the running app uses. It assumes the harness checkout sits beside this repository, and it is the one machine-specific thing in these manifests — drop it if a package is ever published.

Peer dependencies must not be auto-installed (`autoInstallPeers: false` in `pnpm-workspace.yaml`): `@deepseek-ai/dsh-tools` pulls the unpublished `@deepseek-ai/dsh-type-meta` and the install fails outright.

### A browser half is not an ordinary bundle

The shell owns a frozen module table and hands each plugin bundle a `require` answering only its platform specifiers. A browser half must therefore be built as a closure factory registered through `window.__ModuleLoader__.load`, with `react` external and everything else inlined. `packages/turn-nav/tsdown.config.ts` documents the three load-bearing rules; bundling React instead of externalizing it ships a second React whose hooks cannot see the shell's dispatcher.

## Upgrade risk

Moving out of the harness tree removes merge conflicts, not API drift. `turn-nav` reads several interfaces the harness makes no compatibility promise about while it is pre-release — `ctx.sessions.binding()`, the chat snapshot's node `kind` values, the `[data-conversation-scroll]` and `[data-chat-anchor-key]` DOM anchors, `--dsw-alias-*` design tokens, and the `shell.overlay` slot. Expect a harness upgrade to be able to break the rail silently, since every one of those reads is untyped.
