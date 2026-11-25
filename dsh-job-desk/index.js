// dsh-job-desk host half.
// - Settings live in <DSH_HOME>/job-desk/settings.json (no passwords, no cookies).
// - Loopback-only route /dsh-jobs-api: GET → { platforms, settings }, POST → save settings.
// - On start, installs skill/job-recommender/SKILL.md into <DSH_HOME>/skills unless the user changed it.
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { PLATFORMS, DEFAULT_SETTINGS, AUTH_RULES, sanitizeSettings, cookieStatus } from './platforms.js'
import { EdgeProfile } from './edge.js'

const POLL_MS = 5 * 60 * 1000

function pageResult(rule, url, hasCookie) {
  let landed
  try { landed = new URL(url) } catch { return 'unavailable' }
  if (landed.protocol !== 'https:') return 'unavailable'
  const onSite = landed.hostname === rule.domain || landed.hostname.endsWith('.' + rule.domain)
  if (onSite && rule.loginUrl.test(landed.hostname + landed.pathname)) return 'signed-out'
  if (rule.manualOnly) return onSite && hasCookie ? 'cookie-found' : 'unknown'
  // Only platform-specific destinations verified to redirect anonymous visitors qualify without a cookie.
  if (rule.protectedDestination) {
    if (rule.protectedDestination(landed)) return 'session-found'
  } else {
    const expected = new URL(rule.check)
    if (landed.origin === expected.origin && landed.pathname.replace(/\/$/, '') === expected.pathname.replace(/\/$/, '') && hasCookie) return 'session-found'
  }
  return onSite && hasCookie ? 'cookie-found' : 'unknown'
}

export function createTracker(edge, file = null) {
  const state = { status: {}, error: '', checking: false }
  let queue = Promise.resolve()
  const persist = () => { if (file) try { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify({ status: state.status }, null, 2)) } catch { /* best effort */ } }
  const run = (work) => {
    const next = queue.then(async () => {
      state.checking = true
      state.error = ''
      try { await work(); persist(); return state } catch (error) {
        state.error = String(error?.message || error)
        throw error
      } finally { state.checking = false }
    })
    queue = next.catch(() => {})
    return next
  }
  const record = (id, verdict, via, hasCookie, checkedAt) => {
    state.status[id] = { loggedIn: verdict === 'session-found', verdict, checkedAt, via, hasCookie }
  }
  const checkCookies = ({ runningOnly = false } = {}) => run(async () => {
    const cookies = await edge.cookies({ runningOnly })
    if (cookies === null) return
    const signals = cookieStatus(cookies)
    const at = Date.now()
    for (const [id, hasCookie] of Object.entries(signals)) {
      const previous = state.status[id]
      // Retain a page result while the local evidence is unchanged.
      if (previous?.via === 'page' && previous.hasCookie === hasCookie) continue
      record(id, hasCookie ? 'cookie-found' : 'unknown', 'cookie', hasCookie, at)
    }
  })
  const checkPages = (ids = PLATFORMS.map((p) => p.id), options = {}) => run(async () => {
    if (ids.some((id) => !Object.hasOwn(AUTH_RULES, id))) throw new Error('未知平台')
    const result = await edge.checkPages(ids.map((id) => AUTH_RULES[id].check), options)
    if (result === null) return
    const { pages, cookies } = result
    const signals = cookieStatus(cookies)
    const at = Date.now()
    for (const [i, id] of ids.entries()) {
      record(id, pageResult(AUTH_RULES[id], pages[i], signals[id]), 'page', signals[id], at)
    }
  })
  async function checkPage(id) {
    await checkPages([id])
    return state.status[id]
  }
  return { state, checkCookies, checkPage, checkPages }
}

export const name = 'dsh-job-desk'
export const inject = ['webServer']

const ROUTE = '/dsh-jobs-api'
const MAX_BODY = 64 * 1024
const HERE = dirname(fileURLToPath(import.meta.url))

export function dshHome(env = process.env) {
  const v = env.DSH_HOME
  return typeof v === 'string' && v.trim() ? v.trim() : join(homedir(), '.dsh')
}

export const settingsPath = (home = dshHome()) => join(home, 'job-desk', 'settings.json')

export function loadSettings(file = settingsPath()) {
  try { return sanitizeSettings(JSON.parse(readFileSync(file, 'utf8'))) } catch { return structuredClone(DEFAULT_SETTINGS) }
}

export function saveSettings(value, file = settingsPath()) {
  const clean = sanitizeSettings(value)
  mkdirSync(dirname(file), { recursive: true })
  const tmp = file + '.tmp'
  writeFileSync(tmp, JSON.stringify(clean, null, 2), 'utf8')
  renameSync(tmp, file)
  return clean
}

// Upgrade only a byte-for-byte match to the last copy installed by this plugin.
export function installSkill(home = dshHome()) {
  const src = join(HERE, 'skill', 'job-recommender', 'SKILL.md')
  const dest = join(home, 'skills', 'job-recommender', 'SKILL.md')
  const receipt = join(home, 'job-desk', 'skill.sha256')
  const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
  const text = readFileSync(src)
  const current = existsSync(dest) ? readFileSync(dest) : null
  const unchanged = current?.equals(text)
  if (current && !unchanged) {
    const installedHash = existsSync(receipt) ? readFileSync(receipt, 'utf8').trim() : ''
    if (installedHash !== hash(current)) return 'kept-user-copy'
  }
  if (!unchanged) {
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, text)
  }
  mkdirSync(dirname(receipt), { recursive: true })
  writeFileSync(receipt, hash(text), 'utf8')
  return unchanged ? 'unchanged' : 'installed'
}

function isLoopback(req) {
  const a = String(req.socket?.remoteAddress || '')
  return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(obj))
}

const OPEN_DOMAINS = Object.values(AUTH_RULES).map(({ domain }) => domain)

export function canOpen(url) {
  if (typeof url !== 'string' || url.length >= 2000) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.port
      && OPEN_DOMAINS.some((domain) => parsed.hostname === domain || parsed.hostname.endsWith('.' + domain))
  } catch { return false }
}

async function runOp(body, file, tracker, edge) {
  const op = body && body.op
  if (op === 'save' || (!op && body && body.settings)) return { settings: saveSettings(body.settings, file) }
  if (!tracker || !edge) throw new Error('浏览器功能未启用')
  if (op === 'open') {
    let url = body.url
    if (!url && body.platform) {
      const platform = PLATFORMS.find((p) => p.id === body.platform)
      url = tracker.state.status[body.platform]?.loggedIn && platform?.accountPage || platform?.login
    }
    if (!canOpen(url)) throw new Error('只能打开招聘平台的 https 链接')
    await edge.open(url)
    return { opened: url }
  }
  if (op === 'check') {
    if (body.platform) await tracker.checkPage(body.platform)
    else await tracker.checkPages()
    return { auth: tracker.state }
  }
  throw new Error('未知操作')
}

export function createHandler(file = settingsPath(), tracker = null, edge = null) {
  return function handler(req, res) {
    const { host, origin, 'sec-fetch-site': fetchSite, 'content-type': contentType } = req.headers
    const localHost = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host || '')
    const localOrigin = !origin || origin === `http://${host}` || origin === `https://${host}`
    if (!isLoopback(req) || !localHost || !localOrigin || (fetchSite && !['same-origin', 'none'].includes(fetchSite))) {
      return send(res, 403, { ok: false, error: '请从本机 DSH 页面使用求职投递设置' })
    }
    if (req.method === 'GET') {
      return send(res, 200, { ok: true, platforms: PLATFORMS, settings: loadSettings(file), path: file,
        auth: tracker ? tracker.state : null, edge: !!(edge && edge.exe) })
    }
    if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method not allowed' })
    if (!/^application\/json(?:\s*;|$)/i.test(contentType || '')) return send(res, 415, { ok: false, error: 'JSON required' })
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > MAX_BODY) { send(res, 413, { ok: false, error: 'too large' }); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', async () => {
      if (res.writableEnded) return
      let body
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch (e) {
        return send(res, 400, { ok: false, error: 'bad json' })
      }
      try {
        send(res, 200, Object.assign({ ok: true }, await runOp(body, file, tracker, edge)))
      } catch (e) {
        send(res, 400, { ok: false, error: String(e && e.message || e) })
      }
    })
  }
}

export function apply(ctx) {
  try { ctx.logger?.('dsh-job-desk')?.info?.('skill: ' + installSkill()) } catch (e) { console.warn('[dsh-job-desk] skill install failed:', e) }
  const edge = new EdgeProfile(join(dshHome(), 'job-desk', 'browser'))
  const tracker = createTracker(edge, join(dshHome(), 'job-desk', 'status.json'))
  if (edge.exe) {
    // Background check only while the user's window is already running, so we never spawn Edge silently on a timer.
    const tick = () => tracker.checkCookies({ runningOnly: true })
    const first = setTimeout(() => { tick().catch(() => {}) }, 3000)
    const timer = setInterval(() => { tick().catch(() => {}) }, POLL_MS)
    timer.unref?.(); first.unref?.()
    ctx.effect(() => () => { clearInterval(timer); clearTimeout(first) })
  }
  const webServer = ctx.webServer ?? ctx.get?.('webServer')
  if (!webServer) return
  ctx.effect(() => webServer.register({ kind: 'exact', path: ROUTE, handler: createHandler(settingsPath(), tracker, edge) }))
}
