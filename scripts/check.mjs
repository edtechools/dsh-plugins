/**
 * Verifies the failure modes in this repository that are otherwise silent —
 * the plugin loads nothing, or loads a duplicate runtime, while the service
 * starts normally and logs nothing. See the README sections these mirror:
 * the local-development resolution constraint and the browser-bundle rules.
 *
 * Every check is read-only. Exits non-zero if any check fails.
 */

import { execFile } from 'node:child_process'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = join(REPO, 'packages')
const DSH_HOME = process.env.DSH_HOME ?? join(homedir(), '.dsh')
/** Harness checkout, used only to compare the platform module table. */
const HARNESS = process.env.DSH_HARNESS ?? resolve(REPO, '..', 'deepseek-harness')

/** Closure-factory markers the shell's module loader requires; see the browser-half constraint. */
const FACTORY_MARKERS = ['window.__ModuleLoader__.load(', 'var module = { exports: {} }', 'return module.exports;']

let failed = 0
const pass = (m) => console.log(`  [32m✔[39m ${m}`)
const fail = (m, detail) => {
  failed++
  console.log(`  [31m✘[39m ${m}`)
  if (detail !== undefined) for (const line of String(detail).split('\n')) console.log(`      ${line}`)
}
const skip = (m, why) => console.log(`  [90m–[39m ${m} [90m(跳过：${why})[39m`)

/** Extract a `const NAME = [ ... ]` string-array literal from TypeScript source. */
function arrayLiteral(source, name) {
  const start = source.indexOf(`${name} = [`)
  if (start < 0) return undefined
  const end = source.indexOf(']', start)
  if (end < 0) return undefined
  return [...source.slice(start, end).matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
}

/** Every specifier the bundle asks the injected `require` to answer. */
function requiredSpecifiers(bundle) {
  return [...bundle.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1])
}

/** Profiles under `$DSH_HOME/profiles` that declare a dependency on this package. */
function profilesDependingOn(pkgName) {
  const dir = join(DSH_HOME, 'profiles')
  if (!existsSync(dir)) return []
  const found = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === 'node_modules') continue
    const manifest = join(dir, entry.name, 'package.json')
    if (!existsSync(manifest)) continue
    const deps = JSON.parse(readFileSync(manifest, 'utf8')).dependencies ?? {}
    if (Object.hasOwn(deps, pkgName)) found.push(join(dir, entry.name))
  }
  return found
}

/**
 * Import the plugin the way the running app does: resolution starts at the
 * profile directory, follows the install link, and continues from the real
 * path — which is exactly where the flat module fallback stops being reachable.
 */
async function importsFromProfile(pkgName, profileDir) {
  await run(process.execPath, ['-e', `import(${JSON.stringify(pkgName)}).then(()=>process.exit(0),(e)=>{console.error(e.message);process.exit(1)})`], { cwd: profileDir })
}

const packageDirs = readdirSync(PACKAGES, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(PACKAGES, e.name, 'package.json')))
  .map((e) => join(PACKAGES, e.name))

console.log('\ndsh-plugins 自检\n')

/** Platform tables collected per package, compared against the harness once at the end. */
const clientTables = []

for (const dir of packageDirs) {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const name = manifest.name
  console.log(`[1m${name}[22m  (packages/${dir.split('/').pop()})`)

  // 1. Built output — every other check reads it, and a missing lib/ means the
  //    Loader imports nothing.
  const mainPath = join(dir, manifest.main ?? 'lib/index.js')
  if (existsSync(mainPath)) pass('lib/ 已构建')
  else fail('lib/ 已构建', `缺少 ${manifest.main ?? 'lib/index.js'}，先跑 pnpm -r build`)

  // 2. The bundle patch must name this very package; a rename that misses the
  //    patch leaves a row pointing at a package that no longer exists.
  const patchRel = manifest.dsh?.bundle?.patch
  if (patchRel === undefined) {
    skip('cordis.patch.yml 引用名与包名一致', '未声明 dsh.bundle.patch')
  } else {
    const patchPath = join(dir, patchRel)
    if (!existsSync(patchPath)) {
      fail('cordis.patch.yml 引用名与包名一致', `找不到 ${patchRel}`)
    } else {
      const names = [...readFileSync(patchPath, 'utf8').matchAll(/^\s*(?:-\s*)?name:\s*['"]?([^'"\s#]+)/gm)].map((m) => m[1])
      const wrong = names.filter((n) => n !== name)
      if (names.length === 0) fail('cordis.patch.yml 引用名与包名一致', '补丁里没有 name: 行')
      else if (wrong.length > 0) fail('cordis.patch.yml 引用名与包名一致', `补丁引用了 ${wrong.join(', ')}，包名是 ${name}`)
      else pass('cordis.patch.yml 引用名与包名一致')
    }
  }

  // 3. Browser half, when the manifest declares one.
  if (manifest.dsh?.client === undefined) {
    skip('浏览器半边检查', '本包没有 dsh.client')
  } else {
    const clientPath = join(dir, 'lib/client.js')
    if (!existsSync(clientPath)) {
      fail('浏览器半边：产物存在', '缺少 lib/client.js')
    } else {
      const bundle = readFileSync(clientPath, 'utf8')

      const missing = FACTORY_MARKERS.filter((m) => !bundle.includes(m))
      if (missing.length === 0) pass('浏览器半边：闭包工厂协议完整')
      else fail('浏览器半边：闭包工厂协议完整', `产物缺少 ${missing.join(' / ')}`)

      // The node half serves this artifact at /plugins/<package name>/client.js
      // and the loader matches the handoff by the id in the banner.
      const bannerId = /__ModuleLoader__\.load\(\{\s*(?:\n\s*)?id:\s*["']([^"']+)["']/.exec(bundle)?.[1]
      if (bannerId === name) pass('浏览器半边：产物 id 与包名一致')
      else fail('浏览器半边：产物 id 与包名一致', `产物 id 是 ${bannerId ?? '(未找到)'}，包名是 ${name}`)

      const configPath = join(dir, 'tsdown.config.ts')
      const configSource = existsSync(configPath) ? readFileSync(configPath, 'utf8') : ''
      const bundleId = /BUNDLE_ID\s*=\s*['"]([^'"]+)['"]/.exec(configSource)?.[1]
      if (bundleId === name) pass('浏览器半边：tsdown BUNDLE_ID 与包名一致')
      else fail('浏览器半边：tsdown BUNDLE_ID 与包名一致', `BUNDLE_ID 是 ${bundleId ?? '(未找到)'}，包名是 ${name}`)

      const table = arrayLiteral(configSource, 'PLATFORM_MODULES')
      if (table === undefined) {
        fail('浏览器半边：平台模块表可解析', '在 tsdown.config.ts 里找不到 PLATFORM_MODULES')
      } else {
        clientTables.push({ name, table })

        // React inlined instead of external means a second React whose hooks
        // cannot see the shell's dispatcher.
        const reactExternal = requiredSpecifiers(bundle).includes('react')
        const reactInlined = /ReactCurrentDispatcher|react\.production\.min|__SECRET_INTERNALS/.test(bundle)
        if (reactExternal && !reactInlined) pass('浏览器半边：react 为 external，未内联')
        else fail('浏览器半边：react 为 external，未内联', reactInlined ? '产物里出现了 React 源码特征' : '产物没有 require("react")')

        // This repository has no equivalent of the harness's bundle purity
        // gate, so a specifier the frozen table cannot answer only shows up
        // here — otherwise it throws at boot in the browser.
        const unanswerable = [...new Set(requiredSpecifiers(bundle))].filter((s) => !table.includes(s))
        if (unanswerable.length === 0) pass('浏览器半边：所有 require 都在平台表内')
        else fail('浏览器半边：所有 require 都在平台表内', `模块表答不上来：${unanswerable.join(', ')}`)
      }
    }
  }

  // 4. The silent one: composition succeeds, import does not.
  const profiles = profilesDependingOn(name)
  if (profiles.length === 0) {
    skip('可在 profile 上下文中导入', '未安装到任何 profile')
  } else {
    for (const profileDir of profiles) {
      const label = `可在 profile 上下文中导入 (${profileDir.split('/').pop()})`
      try {
        await importsFromProfile(name, profileDir)
        pass(label)
      } catch (error) {
        fail(label, error.stderr?.trim() || error.message)
      }
    }
  }
  console.log('')
}

// 5. The hardcoded platform table drifts silently when the harness changes its own.
console.log('[1mPLATFORM_MODULES 与 harness 同步[22m')
const platformSource = join(HARNESS, 'packages/client/web/src/platform.ts')
if (clientTables.length === 0) {
  skip('平台模块表比对', '没有带浏览器半边的包')
} else if (!existsSync(platformSource)) {
  skip('平台模块表比对', `找不到 harness checkout（设 DSH_HARNESS 指向它，当前找的是 ${HARNESS}）`)
} else {
  const upstream = arrayLiteral(readFileSync(platformSource, 'utf8'), 'PLATFORM_MODULES')
  if (upstream === undefined) {
    fail('平台模块表比对', `无法从 ${platformSource} 解析 PLATFORM_MODULES`)
  } else {
    for (const { name, table } of clientTables) {
      const missing = upstream.filter((m) => !table.includes(m))
      const extra = table.filter((m) => !upstream.includes(m))
      if (missing.length === 0 && extra.length === 0) {
        pass(`${name}：${upstream.length} 项与 harness 一致`)
      } else {
        const detail = [
          missing.length > 0 ? `harness 新增、本仓库缺少（会被内联成重复实例）：${missing.join(', ')}` : '',
          extra.length > 0 ? `本仓库多出、harness 已无（require 会答不上来）：${extra.join(', ')}` : '',
        ].filter(Boolean).join('\n')
        fail(`${name}：与 harness 一致`, detail)
      }
    }
  }
}

console.log('')
if (failed > 0) {
  console.log(`[31m${failed} 项未通过[39m\n`)
  process.exit(1)
}
console.log('[32m全部通过[39m\n')
