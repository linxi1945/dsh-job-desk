// 招聘平台清单。login = 登录页；search = 搜索链接前缀（关键词直接拼在后面，需 encodeURIComponent）。
export const PLATFORMS = [
  { id: 'boss', name: 'BOSS直聘', login: 'https://www.zhipin.com/web/user/', search: 'https://www.zhipin.com/web/geek/job?query=', kind: 'both' },
  { id: 'shixiseng', name: '实习僧', login: 'https://www.shixiseng.com/user/login', accountPage: 'https://www.shixiseng.com/user/accountsetting/mod', search: 'https://www.shixiseng.com/interns?keyword=', kind: 'intern' },
  { id: 'zhaopin', name: '智联招聘', login: 'https://passport.zhaopin.com/login', search: 'https://sou.zhaopin.com/?kw=', kind: 'both' },
  { id: '51job', name: '前程无忧', login: 'https://login.51job.com/login.php', search: 'https://we.51job.com/pc/search?keyword=', kind: 'both' },
  { id: 'nowcoder', name: '牛客', login: 'https://www.nowcoder.com/login', accountPage: 'https://www.nowcoder.com/profile', search: 'https://www.nowcoder.com/search/all?query=', kind: 'both' },
  { id: 'yingjiesheng', name: '应届生求职网', manualConfirmation: true, login: 'https://my.yingjiesheng.com/', search: 'https://s.yingjiesheng.com/search.php?word=', kind: 'both' },
  { id: 'linkedin', name: 'LinkedIn', login: 'https://www.linkedin.com/login', search: 'https://www.linkedin.com/jobs/search/?keywords=', kind: 'full' },
]

// 登录检测规则（未逐一实测，平台改版后可能需要调整）：
// domain = cookie 所属域；cookies = 任一存在即视为有登录凭证；
// check = 需要登录才能看的页面；loginUrl = 最终跳转地址匹配它就算未登录。
export const AUTH_RULES = {
  boss: { domain: 'zhipin.com', cookies: ['wt2', 'zp_at'], check: 'https://www.zhipin.com/web/geek/recommend', loginUrl: /\/web\/user/ },
  shixiseng: {
    domain: 'shixiseng.com', cookies: ['refresh_token', 'x-access-token', 'token'],
    check: 'https://resume.shixiseng.com/my/delivered', loginUrl: /login|signin/,
    protectedDestination: (url) => url.origin === 'https://resume.shixiseng.com' && /^\/my\/delivered\/?$/.test(url.pathname),
  },
  zhaopin: { domain: 'zhaopin.com', cookies: ['at', 'rt'], check: 'https://i.zhaopin.com/', loginUrl: /passport|login/ },
  '51job': { domain: '51job.com', cookies: ['51job', 'ps'], check: 'https://i.51job.com/userset/my_51job.php', loginUrl: /login/ },
  nowcoder: {
    domain: 'nowcoder.com', cookies: ['t', 'NOWCODERUID'], check: 'https://www.nowcoder.com/profile', loginUrl: /login/,
    protectedDestination: (url) => url.origin === 'https://www.nowcoder.com' && /^\/users\/\d+\/?$/.test(url.pathname),
  },
  yingjiesheng: { domain: 'yingjiesheng.com', manualOnly: true, cookies: ['yjs_auth', 'PHPSESSID'], check: 'https://my.yingjiesheng.com/', loginUrl: /login/ },
  linkedin: { domain: 'linkedin.com', cookies: ['li_at'], check: 'https://www.linkedin.com/feed/', loginUrl: /login|authwall|signup/ },
}

// cookies: DevTools Storage.getCookies 结果。返回 { [id]: true|false }
export function cookieStatus(cookies, now = Date.now() / 1000) {
  const out = {}
  for (const [id, r] of Object.entries(AUTH_RULES)) {
    out[id] = cookies.some((c) => {
      const domain = (c.domain || '').replace(/^\./, '').toLowerCase()
      return (domain === r.domain || domain.endsWith('.' + r.domain)) && r.cookies.includes(c.name)
        && c.value && (c.session || !c.expires || c.expires <= 0 || c.expires > now)
    })
  }
  return out
}

export const DEFAULT_SETTINGS = {
  version: 1,
  mode: 'intern', // intern | full
  cities: '',
  salary: '',
  directions: '',
  excludes: '',
  footer: 'AI一键投递，约面或细聊发邮箱或致电，微信同号',
  footerEnabled: true,
  // 每个平台：enabled 是否优先推荐；loggedIn 用户自己确认已在浏览器登录；account 备注（如手机号尾号），不存密码
  platforms: Object.fromEntries(PLATFORMS.map((p) => [p.id, { enabled: ['boss', 'shixiseng'].includes(p.id), loggedIn: false, account: '' }])),
}

const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')

// 只保留已知字段，防止前端写入任意内容。
export function sanitizeSettings(input) {
  const src = input && typeof input === 'object' ? input : {}
  const out = structuredClone(DEFAULT_SETTINGS)
  out.mode = src.mode === 'full' ? 'full' : 'intern'
  for (const k of ['cities', 'salary', 'directions', 'excludes']) out[k] = str(src[k])
  out.footer = typeof src.footer === 'string' ? src.footer.slice(0, 200) : DEFAULT_SETTINGS.footer
  out.footerEnabled = src.footerEnabled !== false
  const ps = src.platforms && typeof src.platforms === 'object' ? src.platforms : {}
  for (const p of PLATFORMS) {
    const v = ps[p.id] && typeof ps[p.id] === 'object' ? ps[p.id] : {}
    out.platforms[p.id] = {
      enabled: typeof v.enabled === 'boolean' ? v.enabled : out.platforms[p.id].enabled,
      loggedIn: v.loggedIn === true,
      account: str(v.account, 60),
    }
  }
  return out
}
