// Dedicated Edge profile for recruitment sites.
// Login data lives in <DSH_HOME>/job-desk/browser and persists across restarts.
// The plugin only reads cookies (via DevTools protocol) to tell whether a login token exists.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/microsoft-edge',
]

export function findEdge(env = process.env) {
  if (env.JOB_DESK_EDGE && existsSync(env.JOB_DESK_EDGE)) return env.JOB_DESK_EDGE
  return EDGE_PATHS.find((p) => existsSync(p)) || null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export class EdgeProfile {
  constructor(dir, exe = findEdge()) {
    this.dir = dir
    this.exe = exe
    this.queue = Promise.resolve()
  }

  portFile() { return join(this.dir, 'DevToolsActivePort') }

  // Returns the browser websocket URL if our profile's Edge is running with DevTools on.
  async endpoint() {
    let port
    try { port = Number(readFileSync(this.portFile(), 'utf8').split(/\r?\n/)[0]) } catch { return null }
    if (!port) return null
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })
      return (await r.json()).webSocketDebuggerUrl || null
    } catch { return null }
  }

  async launch({ headless = false, url = 'about:blank' } = {}) {
    if (!this.exe) throw new Error('没有找到 Edge，请先安装 Microsoft Edge')
    mkdirSync(this.dir, { recursive: true })
    try { rmSync(this.portFile(), { force: true }) } catch { /* stale file */ }
    const args = [
      `--user-data-dir=${this.dir}`, '--remote-debugging-port=0', '--remote-allow-origins=http://127.0.0.1',
      '--no-first-run', '--no-default-browser-check',
    ]
    if (headless) args.push('--headless=new', '--disable-gpu')
    args.push(url)
    const child = spawn(this.exe, args, { detached: true, stdio: 'ignore', windowsHide: headless })
    let spawnError
    child.once('error', (error) => { spawnError = error })
    child.unref()
    for (let i = 0; i < 50; i++) {
      await sleep(200)
      if (spawnError) throw new Error('无法启动 Edge', { cause: spawnError })
      const ws = await this.endpoint()
      if (ws) return ws
    }
    throw new Error('Edge 启动超时')
  }

  // One DevTools command over a fresh websocket.
  static send(ws, method, params = {}, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const sock = new WebSocket(ws)
      const timer = setTimeout(() => { sock.close(); reject(new Error('DevTools 超时: ' + method)) }, timeout)
      sock.onopen = () => sock.send(JSON.stringify({ id: 1, method, params }))
      sock.onerror = () => { clearTimeout(timer); reject(new Error('DevTools 连接失败')) }
      sock.onmessage = (ev) => {
        const msg = JSON.parse(String(ev.data))
        if (msg.id !== 1) return
        clearTimeout(timer)
        sock.close()
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
      }
    })
  }

  enqueue(fn) {
    const next = this.queue.then(fn)
    this.queue = next.catch(() => {})
    return next
  }

  withBrowser(fn, { runningOnly = false } = {}) {
    return this.enqueue(async () => {
      const running = await this.endpoint()
      if (!running && runningOnly) return null
      const ws = running || await this.launch({ headless: true })
      try { return await fn(ws) } finally {
        if (!running) await this.close(ws)
      }
    })
  }

  // Closes the browser and waits until it has fully exited, so the next call never reuses a dying instance.
  async close(ws) {
    await EdgeProfile.send(ws, 'Browser.close').catch(() => {})
    for (let i = 0; i < 25 && (await this.endpoint()); i++) await sleep(200)
    try { rmSync(this.portFile(), { force: true }) } catch { /* still locked */ }
  }

  cookies({ runningOnly = false } = {}) {
    return this.withBrowser(async (ws) => (await EdgeProfile.send(ws, 'Storage.getCookies')).cookies || [], { runningOnly })
  }

  // Opens url in the visible window, starting it if needed.
  open(url) {
    return this.enqueue(async () => {
      const ws = await this.endpoint()
      if (!ws) { await this.launch({ url }); return }
      await EdgeProfile.send(ws, 'Target.createTarget', { url })
    })
  }

  async probeTab(ws, url, waitMs = 6000) {
    const { targetId } = await EdgeProfile.send(ws, 'Target.createTarget', { url, background: true })
    try {
      await sleep(waitMs)
      const { targetInfos } = await EdgeProfile.send(ws, 'Target.getTargets')
      return targetInfos.find((target) => target.targetId === targetId)?.url || ''
    } finally {
      await EdgeProfile.send(ws, 'Target.closeTarget', { targetId }).catch(() => {})
    }
  }

  finalUrl(url, waitMs) {
    return this.withBrowser((ws) => this.probeTab(ws, url, waitMs))
  }

  async checkPages(urls, { runningOnly = false } = {}) {
    return this.withBrowser(async (ws) => {
      const pages = []
      for (let i = 0; i < urls.length; i += 3) {
        const batch = await Promise.allSettled(urls.slice(i, i + 3).map((url) => this.probeTab(ws, url)))
        pages.push(...batch.map((result) => result.status === 'fulfilled' ? result.value : ''))
      }
      const { cookies = [] } = await EdgeProfile.send(ws, 'Storage.getCookies')
      return { pages, cookies }
    }, { runningOnly })
  }
}
