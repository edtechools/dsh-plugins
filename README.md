# dsh-plugins

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 用的仓库外插件。这里的东西都不在 harness 的 checkout 里，所以 harness 那边 `git pull` 永远不会跟这些改动冲突。

| 包 | 面 | 作用 |
|---|---|---|
| [`packages/turn-nav`](packages/turn-nav) | node + 浏览器 | 对话区左缘的轮次导航条 |
| [`packages/web-search`](packages/web-search) | node | 基于博查搜索 API 的 `bocha_web_search` 工具 |

每个包本身就是一个 **bundle**（manifest 里声明 `dsh.bundle.patch`），所以 `dsh` 会自己把它的层追加进 profile。`dsh plugin --profile web remove dsh-plugin-turn-nav` 会同时移除依赖和它的层。profile 自己的 `cordis.patch.yml` 保持 `[]`，只用来放这台机器专属的行覆盖。

## 装法一：本地开发

改代码即刻生效，日常用这个。

```sh
pnpm install && pnpm -r build
dsh plugin --profile web add ./packages/turn-nav ./packages/web-search
dsh --profile web --dump-config    # 每个 bundle 一个带标签的层
```

记录下来的是 `link:`，指向本仓库里的真实路径。代价见下面的[约束一](#约束一仅限本地开发link-够不着扁平兜底目录)。

## 装法二：从 GitHub

插件稳定之后用这个。**pin commit**，否则仓库下一次 push 就能悄悄改变装机时执行的代码。

```sh
dsh plugin --profile web add "github:edtechools/dsh-plugins#<sha>&path:/packages/turn-nav"
```

子目录参数在**有 sha 时写 `&path:`**（`#` 已经被 sha 占了），没有 sha 时才是 `#path:/packages/turn-nav`。

第一次一定会失败：pnpm 拒绝执行 git 依赖的 `prepare` 脚本，直到显式放行。按报错里打印的 key 加进 profile 的 `pnpm-workspace.yaml` 再重试：

```yaml
allowBuilds:
  "dsh-plugin-turn-nav@https://codeload.github.com/edtechools/dsh-plugins/tar.gz/<sha>#path:/packages/turn-nav": true
```

两个坑：

- key **不是包名**，是内嵌了 sha 的完整 URL。所以**每次 pin 新 sha，都要同步换掉这条 key**，否则又被拦——升级插件时最容易忘的一步。
- key 里有 `#`，**YAML 必须加引号**，否则 `#` 之后被当成注释，放行静默失效。

放行的分量要清楚：**这是授权该包在你机器上装机时执行代码**，在 agent 的沙箱之外。不想要这个授权就发构建好的产物——`pnpm publish`（`lib/` 在发布时构建）或 `pnpm pack` 出 tarball，两种都不需要任何构建权限。

## 加一个新插件

1. 建 `packages/<name>/`，放 `package.json`（`dsh.bundle.patch`；有浏览器半边就再加 `dsh.client`）、`cordis.patch.yml`、`tsdown.config.ts`、`src/`。
2. `pnpm install && pnpm -r build`
3. `dsh plugin --profile web add ./packages/<name>`

从最接近的现有包复制改，别从零写——那两份构建配置里编码了一些不明显的约束。

## 约束一（仅限本地开发）：`link:` 够不着扁平兜底目录

**只影响装法一。** git 安装、npm 安装、tarball 安装都不受这条约束，原因在本节末尾。

harness 会维护一个扁平兜底目录 `$DSH_HOME/profiles/node_modules`，让裸插件名能被解析。它的前提是插件物理位于 profile 树内：Node 往上找时先命中 profile 自己的 `node_modules`，再命中这个兜底目录。

但 `dsh plugin add ./packages/x` 记的是 `link:`，包的真实路径留在本仓库内，而 **Node 默认跟随符号链接**——一个模块自己的 import 是从**真实路径**开始往上找的：

```
真实路径  ~/dsh-plugins/packages/web-search/lib/index.js
往上找    ~/dsh-plugins/packages/web-search/node_modules
          ~/dsh-plugins/node_modules
          ~/node_modules
          /node_modules              ← 永远到不了 ~/.dsh/profiles/
```

**这个失败是静默的**：web 服务照常启动、日志无输出、`--dump-config` 照常显示那一行——因为组合成功不等于导入成功。

什么都不 import 的插件不受影响（`turn-nav` 的 node 半边是空的）。一旦 import 了 `@deepseek-ai/dsh-tools` 或任何别的 Service Definition，就会 `ERR_MODULE_NOT_FOUND`。解法是在 peerDependency 旁边补一条指向 harness checkout 的 `link:` devDependency：

```json
"peerDependencies": { "@deepseek-ai/dsh-tools": "*" },
"devDependencies": { "@deepseek-ai/dsh-tools": "link:../../../deepseek-harness/packages/core/tools" }
```

装完用这条命令确认（它精确复现 app 的解析上下文）：

```sh
cd ~/.dsh/profiles/web && node -e "import('dsh-plugin-<name>').then(m=>console.log('OK',Object.keys(m))).catch(e=>console.log('FAILED',e.message))"
```

那条 `link:` 是**唯一跟机器绑定**的东西，它假定 harness checkout 就在本仓库旁边。而它**只服务于本地开发**：git 安装时包物理落在 `~/.dsh/profiles/<name>/node_modules/` 里，往上找就够得着兜底目录，peer 自然解析得到；devDependency 又不随包发布（装完的包连 `node_modules` 目录都没有），所以这条 `link:` 压根不参与。

一个现在安全、但要留意的副作用：`link:` 指向 harness 的 `lib/`（构建产物），而 app 用 `pnpm dsh` 从源码跑时加载的是 `.ts` 源码——**同一个包存在两份实例**。目前无害，因为 `defineTool` 返回纯对象、跨边界不做身份比较。哪天某个 harness 包用上 `Symbol`、`instanceof` 或模块级单例，就得改用装法二。

## 约束二：浏览器半边不是普通产物

浏览器半边是被 fetch 到 shell 的模块图**之外**的（服务在 `/plugins/<id>/client.js`），没有打包器在运行时替它解析 import。取而代之的是闭包工厂协议：

```js
window.__ModuleLoader__.load({ id: "dsh-plugin-turn-nav", factory: (require) => {
  var module = { exports: {} }; var exports = module.exports;
  /* CJS 形态的代码体 */
  return module.exports; } });
```

注入的 `require` **只回答一张冻结的表**（harness 的 `PLATFORM_MODULES`）：`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`，以及 5 个 dsh 客户端包。由此两条死规矩：**表里的必须 external**（否则多一份实例），**表外的必须内联**（否则那个 `require` 答不上来，运行时直接抛）。

四个具体的坑：

1. **React 必须 external。** 打进去就是第二份 React，它的 hooks 看不到 shell 的 dispatcher。验证：`grep -c 'require("react")' lib/client.js` 应为 1，`grep -c ReactCurrentDispatcher lib/client.js` 应为 0。
2. **`BUNDLE_ID` 必须等于包名。** node 半边按包名在 `/plugins/<包名>/client.js` 提供服务，loader 按这个 id 匹配交接。这个值在 `package.json` 和 `tsdown.config.ts` 里各有一份，改包名忘了改另一处，产物就注册到错误的 key 上，**静默不挂载**。
3. **这里没有 harness 的"纯度门禁"。** harness 自己的构建有个 `dsh-client-bundle-purity` 插件，任何不在平台表里的 `@deepseek-ai/*` 值导入会直接构建报错；本仓库的配置**没有**。所以你能毫无阻碍地 import 另一个 dsh 客户端包，构建通过、运行时才炸（或更隐蔽：拿到重复实例）。跨插件协作走 cordis 服务。
4. **`PLATFORM_MODULES` 会漂移。** 那张表是硬抄进来的。升级 harness 后比对一次：

   ```sh
   diff <(grep -A12 "PLATFORM_MODULES = \[" ~/deepseek-harness/packages/client/web/src/platform.ts) \
        <(grep -A12 "PLATFORM_MODULES = \[" ~/dsh-plugins/packages/turn-nav/tsdown.config.ts)
   ```

另外 harness 自己的客户端构建还支持 CSS Modules（lightningcss 编译 + 自动注入 `<style data-plugin>`），本仓库的配置没有。`turn-nav` 不受影响，它自己手动注入 `<style>`。以后要用 `.module.css`，得把那段插件逻辑搬过来。

## 升级风险

搬出 harness 仓库消除的是合并冲突，不是 API 漂移。`turn-nav` 读了好几个 harness 在预发布期不作兼容承诺的接口——`ctx.sessions.binding()`、对话快照的节点 `kind` 取值、`[data-conversation-scroll]` 与 `[data-chat-anchor-key]` 这两个 DOM 约定、`--dsw-alias-*` 设计令牌、以及 `shell.overlay` 插槽。要预期 harness 升级可能让导航条**静默失效**：上面每一处读取都是无类型的，TypeScript 帮不上忙。

这一条和上面两条约束有个共同点：**失败都是静默的**。升级 harness 之后，至少跑一遍两个插件的导入检查和 `PLATFORM_MODULES` 比对。
