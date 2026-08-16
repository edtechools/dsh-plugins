# dsh-plugins

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的仓库外插件。这里的东西都不在 harness 的 checkout 里，所以 harness 那边 `git pull` 永远不会跟这些改动冲突。

| 包 | 面 | 作用 |
|---|---|---|
| [`packages/turn-nav`](packages/turn-nav) | node + 浏览器 | 对话区左缘的轮次导航条 |
| [`packages/web-search`](packages/web-search) | node | 基于博查搜索 API 的 `bocha_web_search` 工具 |

## 装进 profile

每个包本身就是一个 **bundle**（manifest 里声明 `dsh.bundle.patch`），所以 `dsh` 会自己把它的层追加进 profile：

```sh
pnpm install && pnpm -r build
dsh plugin --profile web add ./packages/turn-nav ./packages/web-search
dsh --profile web --dump-config    # 每个 bundle 一个带标签的层
```

`dsh plugin --profile web remove dsh-plugin-turn-nav` 会同时移除依赖和它的层。profile 自己的 `cordis.patch.yml` 保持 `[]`，只用来放这台机器专属的行覆盖。

## 加一个新插件

1. 建 `packages/<name>/`，放 `package.json`（`dsh.bundle.patch`；有浏览器半边就再加 `dsh.client`）、`cordis.patch.yml`、`tsdown.config.ts`、`src/`。
2. `pnpm install && pnpm -r build`
3. `dsh plugin --profile web add ./packages/<name>`

从最接近的现有包复制改，别从零写——那两份构建配置里编码了一些不明显的约束。

## 两个会咬人的约束

### import harness 的包，需要一条 `link:` devDependency

harness 会维护一个扁平兜底目录 `$DSH_HOME/profiles/node_modules`，让裸插件名能被解析。**但从这里够不着它。** `dsh plugin add ./packages/x` 记的是 `link:`，包的真实路径留在本仓库内，而 Node 从真实路径往上找 `node_modules` 永远走不到 `$DSH_HOME/profiles/`。

什么都不 import 的插件不受影响（`turn-nav` 的 node 半边就是空的）。一旦 import 了 `@deepseek-ai/dsh-tools` 或任何别的 Service Definition，加载时就会 `ERR_MODULE_NOT_FOUND`。解法是在 peerDependency 旁边补一条指向 harness checkout 的 `link:` devDependency：

```json
"peerDependencies": { "@deepseek-ai/dsh-tools": "*" },
"devDependencies": { "@deepseek-ai/dsh-tools": "link:../../../deepseek-harness/packages/core/tools" }
```

这样解析到的是运行中的 app 正在用的同一份物理包。它假定 harness checkout 就在本仓库旁边，是这些 manifest 里唯一跟机器绑定的东西——哪天要发布某个包，把它删掉。

peerDependency 不能自动安装（`pnpm-workspace.yaml` 里的 `autoInstallPeers: false`）：`@deepseek-ai/dsh-tools` 会拉未发布的 `@deepseek-ai/dsh-type-meta`，装一次失败一次。

### 浏览器半边不是普通产物

shell 持有一张冻结的模块表，只把它的平台标识符通过注入的 `require` 交给插件。所以浏览器半边必须打成闭包工厂、经 `window.__ModuleLoader__.load` 注册，`react` 保持 external、其余一律内联。三条要害规则写在 `packages/turn-nav/tsdown.config.ts` 里；把 React 打进去而不是 external，等于多发一份 React，它的 hooks 看不到 shell 的 dispatcher。

## 升级风险

搬出 harness 仓库消除的是合并冲突，不是 API 漂移。`turn-nav` 读了好几个 harness 在预发布期不作兼容承诺的接口——`ctx.sessions.binding()`、对话快照的节点 `kind` 取值、`[data-conversation-scroll]` 与 `[data-chat-anchor-key]` 这两个 DOM 约定、`--dsw-alias-*` 设计令牌、以及 `shell.overlay` 插槽。要预期 harness 升级可能让导航条**静默失效**：上面每一处读取都是无类型的，TypeScript 帮不上忙。
