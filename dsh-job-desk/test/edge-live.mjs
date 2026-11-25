// Manual live check against a scratch Edge profile (not part of npm test).
import { EdgeProfile } from '../edge.js'
import { cookieStatus, AUTH_RULES } from '../platforms.js'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'jd-edge-'))
const edge = new EdgeProfile(dir)
console.log('edge exe:', edge.exe)
try {
  const cookies = await edge.cookies()
  console.log('cookies in fresh profile:', cookies.length, JSON.stringify(cookieStatus(cookies)))
  const { createTracker } = await import('../index.js')
  const st = await createTracker(edge).checkPage('boss')
  console.log('boss page check on empty profile:', JSON.stringify(st), st.loggedIn === false ? 'OK' : 'WRONG')
  if (st.loggedIn !== false) process.exitCode = 1
  console.log('running after temp close:', !!(await edge.endpoint()))
} catch (e) {
  console.error('FAIL', e)
  process.exitCode = 1
} finally {
  await new Promise((r) => setTimeout(r, 1500))
  try { rmSync(dir, { recursive: true, force: true }) } catch (e) { console.log('cleanup later:', e.code) }
}
