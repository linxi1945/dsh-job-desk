import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import { loadSettings, saveSettings, installSkill, createHandler, createTracker } from '../index.js'
import { AUTH_RULES, PLATFORMS } from '../platforms.js'
import { EdgeProfile } from '../edge.js'

const tmp = () => mkdtempSync(join(tmpdir(), 'jd-'))

test('defaults and sanitize', () => {
  const f = join(tmp(), 's.json')
  assert.equal(loadSettings(f).mode, 'intern')
  const s = saveSettings({ mode: 'full', cities: '深圳', password: 'x', platforms: { boss: { loggedIn: true, account: '1234', token: 'y' } } }, f)
  const disk = JSON.parse(readFileSync(f, 'utf8'))
  assert.equal(disk.mode, 'full')
  assert.equal(disk.password, undefined)
  assert.equal(disk.platforms.boss.token, undefined)
  assert.equal(disk.platforms.boss.loggedIn, true)
  assert.equal(s.platforms.shixiseng.enabled, true)
})

test('skill install upgrades only an unchanged plugin-owned copy', () => {
  const home = tmp()
  assert.equal(installSkill(home), 'installed')
  const skill = join(home, 'skills', 'job-recommender', 'SKILL.md')
  const bundled = readFileSync(skill, 'utf8')
  assert.equal(installSkill(home), 'unchanged')
  writeFileSync(skill, bundled + '\\nlocal edit\\n')
  assert.equal(installSkill(home), 'kept-user-copy')
  assert.match(readFileSync(skill, 'utf8'), /local edit/)

  const cleanHome = tmp()
  installSkill(cleanHome)
  const cleanSkill = join(cleanHome, 'skills', 'job-recommender', 'SKILL.md')
  const previous = Buffer.from(bundled + '\nprevious release\n')
  writeFileSync(cleanSkill, previous)
  writeFileSync(join(cleanHome, 'job-desk', 'skill.sha256'), createHash('sha256').update(previous).digest('hex'))
  assert.equal(installSkill(cleanHome), 'installed')
  assert.equal(readFileSync(cleanSkill, 'utf8'), bundled)

  const preexistingHome = tmp()
  const preexistingSkill = join(preexistingHome, 'skills', 'job-recommender', 'SKILL.md')
  mkdirSync(join(preexistingHome, 'skills', 'job-recommender'), { recursive: true })
  writeFileSync(preexistingSkill, 'unmanaged user copy')
  assert.equal(installSkill(preexistingHome), 'kept-user-copy')
  assert.equal(readFileSync(preexistingSkill, 'utf8'), 'unmanaged user copy')
})

function call(handler, method, body, addr = '127.0.0.1', headers = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter()
    Object.assign(req, { method, headers: { host: 'localhost:1234', origin: 'http://localhost:1234', 'sec-fetch-site': 'same-origin', 'content-type': 'application/json', ...headers }, socket: { remoteAddress: addr }, destroy() {} })
    const res = { code: 0, writableEnded: false, writeHead(c) { this.code = c }, end(t) { this.writableEnded = true; resolve({ code: this.code, json: JSON.parse(t) }) } }
    handler(req, res)
    if (body !== undefined) { req.emit('data', Buffer.from(body)); req.emit('end') }
  })
}

test('http handler', async () => {
  const f = join(tmp(), 's.json')
  const hd = createHandler(f)
  assert.equal((await call(hd, 'GET', undefined, '10.0.0.2')).code, 403)
  assert.equal((await call(hd, 'GET', undefined, '127.0.0.1', { host: 'foreign.example' })).code, 403)
  assert.equal((await call(hd, 'POST', '{}', '127.0.0.1', { origin: 'https://foreign.example' })).code, 403)
  assert.equal((await call(hd, 'POST', '{}', '127.0.0.1', { 'content-type': 'text/plain' })).code, 415)
  const g = await call(hd, 'GET')
  assert.equal(g.json.platforms.length > 5, true)
  const p = await call(hd, 'POST', JSON.stringify({ settings: { cities: '武汉' } }))
  assert.equal(p.json.settings.cities, '武汉')
  assert.equal((await call(hd, 'POST', '{bad')).code, 400)
})

test('cookie status and open allowlist', async () => {
  const { cookieStatus } = await import('../platforms.js')
  const { canOpen } = await import('../index.js')
  const now = 1000
  const st = cookieStatus([
    { domain: '.zhipin.com', name: 'wt2', value: 'x', expires: 2000 },
    { domain: '.linkedin.com', name: 'li_at', value: 'x', expires: 500 },
    { domain: 'evilzhipin.com.cn', name: 'wt2', value: 'x', session: true },
  ], now)
  assert.equal(st.boss, true)
  assert.equal(st.linkedin, false)
  assert.equal(st.shixiseng, false)
  assert.equal(canOpen('https://www.zhipin.com/job_detail/1.html'), true)
  assert.equal(canOpen('https://zhipin.com.evil.cn/'), false)
  assert.equal(canOpen('https://sub.zhipin.com.evil.com/'), false)
  assert.equal(canOpen('https://attacker@www.zhipin.com/'), false)
  assert.equal(canOpen('https://www.zhipin.com:444/'), false)
  assert.equal(canOpen('http://www.zhipin.com/'), false)
  assert.equal(canOpen('file:///C:/x'), false)
})

test('browser ops refused without edge', async () => {
  const hd = createHandler(join(tmp(), 's.json'))
  const r = await call(hd, 'POST', JSON.stringify({ op: 'open', platform: 'boss' }))
  assert.equal(r.code, 400)
})

test('refresh all runs page checks and distinguishes uncertainty from logout', async () => {
  const home = tmp()
  const file = join(home, 'status.json')
  const fixture = 'fixture-value-not-for-disk'
  const cookies = [
    { domain: '.zhipin.com', name: 'wt2', value: fixture, session: true },
    { domain: '.shixiseng.com', name: 'token', value: fixture, session: true },
    { domain: '.zhaopin.com', name: 'at', value: fixture, session: true },
  ]
  const edge = {
    async checkPages(urls) {
      assert.deepEqual(urls, PLATFORMS.map((p) => AUTH_RULES[p.id].check))
      return { cookies, pages: urls.map((url, i) => ({
        shixiseng: 'https://www.shixiseng.com/user/login',
        zhaopin: 'https://www.zhaopin.com/',
        linkedin: 'chrome-error://chromewebdata/',
        yingjiesheng: 'https://www.yingjiesheng.com/',
      })[PLATFORMS[i].id] ?? url) }
    },
    async cookies() { return cookies },
  }
  const tracker = createTracker(edge, file)
  const handler = createHandler(join(home, 'settings.json'), tracker, edge)
  const response = await call(handler, 'POST', JSON.stringify({ op: 'check' }))
  assert.equal(response.code, 200)
  const { status, checking } = response.json.auth
  assert.equal(checking, false)
  assert.equal(Object.keys(status).length, PLATFORMS.length)
  assert.equal(status.boss.verdict, 'session-found')
  assert.equal(status.shixiseng.verdict, 'signed-out')
  assert.equal(status.zhaopin.verdict, 'cookie-found')
  assert.equal(status.linkedin.verdict, 'unavailable')
  assert.equal(status['24365'], undefined)
  assert.equal(status.liepin, undefined)
  assert.equal(status.yingjiesheng.verdict, 'unknown')
  assert.equal(Object.values(status).every((row) => row.checkedAt > 0 && row.via === 'page'), true)
  await tracker.checkCookies({ runningOnly: true })
  assert.deepEqual(tracker.state.status, status)
  assert.equal(readFileSync(file, 'utf8').includes(fixture), false)
})

test('recognizes Shixiseng and Nowcoder protected destinations and opens account pages', async () => {
  const destinations = [AUTH_RULES.shixiseng.check, 'https://www.nowcoder.com/users/12345']
  const opened = []
  const edge = {
    async checkPages(urls) { return { pages: urls.map((url) => destinations[url === AUTH_RULES.nowcoder.check ? 1 : 0]), cookies: [] } },
    async open(url) { opened.push(url) },
  }
  const tracker = createTracker(edge)
  const handler = createHandler(join(tmp(), 's.json'), tracker, edge)
  const post = (op, platform) => call(handler, 'POST', JSON.stringify({ op, platform }))
  for (const id of ['shixiseng', 'nowcoder']) {
    const result = await post('check', id)
    assert.equal(result.json.auth.status[id].verdict, 'session-found')
    assert.equal((await post('open', id)).code, 200)
    assert.equal(opened.at(-1), PLATFORMS.find((p) => p.id === id).accountPage)
  }
  destinations[1] = 'https://www.nowcoder.com/users/12345/profile'
  assert.equal((await post('check', 'nowcoder')).json.auth.status.nowcoder.verdict, 'unknown')
  assert.equal((await post('check', '24365')).code, 400)
  assert.equal((await post('open', 'liepin')).code, 400)
})

test('failed page check reports an error and does not block retry', async () => {
  let attempts = 0
  const edge = { async checkPages() {
    if (++attempts === 1) throw new Error('Edge 启动超时')
    return { pages: [AUTH_RULES.boss.check], cookies: [] }
  } }
  const tracker = createTracker(edge)
  const handler = createHandler(join(tmp(), 's.json'), tracker, edge)
  const body = JSON.stringify({ op: 'check', platform: 'boss' })
  assert.equal((await call(handler, 'POST', body)).json.error, 'Edge 启动超时')
  const retry = await call(handler, 'POST', body)
  assert.equal(retry.json.auth.status.boss.verdict, 'unknown')
  assert.equal(retry.json.auth.error, '')
})

test('running-only background check does not start Edge', async () => {
  const edge = new EdgeProfile('unused', null)
  edge.endpoint = async () => null
  edge.launch = async () => { assert.fail('background check started Edge') }
  assert.equal(await edge.cookies({ runningOnly: true }), null)
})
