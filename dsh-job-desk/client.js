/**
 * dsh-job-desk client half: registers 设置 → 求职投递 section.
 * Loaded by the DSH web ModuleLoader; id must equal the package name.
 */
window.__ModuleLoader__.load((() => {
  const base = (() => {
    const s = document.currentScript && document.currentScript.src
    const m = /^(?:https?:\/\/[^/]+)?(.*?)\/plugins\//.exec(s ? new URL(s, location.href).pathname : '')
    return m ? m[1].replace(/\/+$/, '') : ''
  })()
  const API = base + '/dsh-jobs-api'

  return {
    id: 'dsh-job-desk',
    factory: (require) => {
      var module = { exports: {} }
      var exports = module.exports
      Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
      const React = require('react')
      const h = React.createElement

      const CSS = [
        '.jd{display:flex;flex-direction:column;gap:16px;font-size:13px;color:var(--dsw-alias-label-primary)}',
        '.jd h4{margin:0 0 6px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-secondary)}',
        '.jd .hint{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5}',
        '.jd .grid{display:grid;grid-template-columns:110px 1fr;gap:8px 10px;align-items:center}',
        '.jd input[type=text]{width:100%;box-sizing:border-box;padding:6px 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-1);color:inherit}',
        '.jd table{width:100%;border-collapse:collapse}',
        '.jd td,.jd th{padding:6px 4px;border-bottom:1px solid var(--dsw-alias-border-l1);text-align:left;font-weight:normal}',
        '.jd th{font-size:12px;color:var(--dsw-alias-label-secondary)}',
        '.jd button{padding:5px 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:inherit;cursor:pointer}',
        '.jd button.primary{background:var(--dsw-alias-accent,#4d6bfe);color:#fff;border-color:transparent}',
        '.jd .ok{color:#16a34a}.jd .no{color:var(--dsw-alias-label-secondary)}',
        '.jd a{color:var(--dsw-alias-accent,#4d6bfe)}',
      ].join('')

      function useStyle() {
        React.useEffect(() => {
          if (document.getElementById('dsh-job-desk-style')) return
          const el = document.createElement('style')
          el.id = 'dsh-job-desk-style'
          el.textContent = CSS
          document.head.appendChild(el)
        }, [])
      }

      function Panel() {
        useStyle()
        const [data, setData] = React.useState(null)
        const [s, setS] = React.useState(null)
        const [msg, setMsg] = React.useState('')
        const [auth, setAuth] = React.useState(null)
        const [busy, setBusy] = React.useState('')
        const [authMsg, setAuthMsg] = React.useState('')
        const [jobUrl, setJobUrl] = React.useState('')
        const revision = React.useRef(0)
        const active = React.useRef(false)
        React.useEffect(() => {
          fetch(API).then((r) => r.json()).then((d) => { setData(d); setS(d.settings); setAuth(d.auth) })
            .catch((e) => setMsg('读取失败：' + e.message))
          // A cached GET started before a manual check must not replace its fresh result.
          const refresh = async () => {
            if (active.current) return
            const request = ++revision.current
            try {
              const r = await fetch(API, { cache: 'no-store' })
              const d = await r.json()
              if (d.ok && request === revision.current) setAuth(d.auth)
            } catch { /* next poll can recover */ }
          }
          const t = setInterval(refresh, 20000)
          window.addEventListener('focus', refresh)
          return () => { ++revision.current; clearInterval(t); window.removeEventListener('focus', refresh) }
        }, [])
        const op = async (payload, label) => {
          if (active.current) return
          active.current = true
          ++revision.current
          setBusy(label)
          setAuthMsg(payload.op === 'check' ? '正在访问检测页，请稍候…' : '')
          try {
            const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const d = await r.json()
            if (!r.ok || !d.ok) throw new Error(d.error || '请求失败')
            if (d.auth) setAuth(d.auth)
            if (payload.op === 'check') {
              const rows = Object.entries(d.auth?.status || {}).filter(([id]) => !payload.platform || id === payload.platform)
              const pending = rows.filter(([, a]) => !a.loggedIn && a.verdict !== 'signed-out').length
              setAuthMsg(`刷新完成 · ${new Date().toLocaleTimeString()} · 检查 ${rows.length} 个平台${pending ? `，${pending} 个无法确认` : ''}`)
            } else {
              setAuthMsg(payload.url ? '已在专用 Edge 打开，后续请在平台手动操作。' : '已打开专用 Edge。登录后，回到这里点「检测」。')
            }
          } catch (e) {
            setAuthMsg((payload.op === 'check' ? '刷新失败：' : '打开失败：') + e.message)
          } finally {
            active.current = false
            setBusy('')
          }
        }
        if (!s) return h('div', { className: 'jd' }, msg || '加载中…')

        const set = (k, v) => setS(Object.assign({}, s, { [k]: v }))
        const setP = (id, k, v) => setS(Object.assign({}, s, {
          platforms: Object.assign({}, s.platforms, { [id]: Object.assign({}, s.platforms[id], { [k]: v }) }),
        }))
        const save = () => {
          setMsg('保存中…')
          fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings: s }) })
            .then((r) => r.json())
            .then((d) => { if (d.ok) { setS(d.settings); setMsg('已保存。新对话里发简历即可按这些设置推荐。') } else setMsg('保存失败：' + d.error) })
            .catch((e) => setMsg('保存失败：' + e.message))
        }
        const text = (k, ph) => h('input', { type: 'text', value: s[k], placeholder: ph, onChange: (e) => set(k, e.target.value) })

        return h('div', { className: 'jd' },
          h('div', null,
            h('h4', null, '招聘平台账号'),
            h('div', { className: 'hint' }, '请在点「登录」打开的专用 Edge 中登录。「检测」和「刷新全部状态」会访问平台检测页。未能确认登录不代表账号已退出。插件不会替你投递。'),
            data.edge ? null : h('div', { className: 'no' }, '没有找到 Edge，登录和状态检测不可用。'),
            auth && auth.error ? h('div', { className: 'no' }, '检测出错：' + auth.error) : null,
            authMsg ? h('div', { className: 'hint', role: 'status' }, authMsg) : null,
            h('table', null,
              h('thead', null, h('tr', null, ['平台', '优先', '状态', '账号备注', ''].map((t) => h('th', { key: t }, t)))),
              h('tbody', null, data.platforms.map((p) => {
                const v = s.platforms[p.id] || {}
                const a = auth && auth.status && auth.status[p.id]
                const labels = {
                  'session-found': '检测到登录', 'cookie-found': '有凭证，待确认',
                  'signed-out': '未登录', 'unavailable': '检测页不可用', 'unknown': '无法确认',
                }
                const manual = p.manualConfirmation && v.loggedIn && !a?.loggedIn && a?.verdict !== 'signed-out'
                const stale = a?.via === 'page' && Date.now() - a.checkedAt > 24 * 60 * 60 * 1000
                const label = manual ? '手动确认（未自动验证）' : stale ? '检测已过期' : !a ? '未检测' : labels[a.verdict] || '请刷新状态'
                const when = a ? new Date(a.checkedAt).toLocaleTimeString() + (a.via === 'page' ? ' · 页面检测' : ' · 本地检测') : ''
                return h('tr', { key: p.id },
                  h('td', null, p.name),
                  h('td', null, h('input', { type: 'checkbox', checked: !!v.enabled, onChange: (e) => setP(p.id, 'enabled', e.target.checked) })),
                  h('td', { title: when }, h('span', { className: a?.loggedIn && !stale ? 'ok' : 'no' }, '● ' + label),
                    p.manualConfirmation ? h('label', { style: { display: 'block' } }, h('input', { type: 'checkbox', checked: !!v.loggedIn, onChange: (e) => setP(p.id, 'loggedIn', e.target.checked) }), ' 我已登录（需保存）') : null),
                  h('td', null, h('input', { type: 'text', value: v.account || '', placeholder: '如 手机尾号1234', onChange: (e) => setP(p.id, 'account', e.target.value) })),
                  h('td', { style: { whiteSpace: 'nowrap' } },
                    h('button', { disabled: !data.edge || !!busy, onClick: () => op({ op: 'open', platform: p.id }, p.id) }, a?.loggedIn && !stale ? '打开' : '登录'), ' ',
                    h('button', { disabled: !data.edge || !!busy, onClick: () => op({ op: 'check', platform: p.id }, p.id + '-c') }, busy === p.id + '-c' ? '检测中' : '检测')))
              }))),
            h('div', { style: { marginTop: 8 } },
              h('button', { disabled: !data.edge || !!busy, onClick: () => op({ op: 'check' }, 'all') }, busy === 'all' ? '刷新中…' : '刷新全部状态')),
            h('form', { style: { display: 'flex', gap: 8, marginTop: 8 }, onSubmit: (e) => { e.preventDefault(); op({ op: 'open', url: jobUrl.trim() }, 'job-url') } },
              h('input', { type: 'text', 'aria-label': '招聘平台链接', placeholder: '粘贴受支持平台的岗位或搜索链接', value: jobUrl, onChange: (e) => setJobUrl(e.target.value) }),
              h('button', { type: 'submit', disabled: !data.edge || !!busy || !jobUrl.trim(), style: { whiteSpace: 'nowrap' } }, '在专用 Edge 打开')),
            h('div', { className: 'hint' }, '直接点聊天里的链接可能会用默认浏览器。需要沿用专用 Edge 的登录时，在这里粘贴链接；公司官网请直接打开。')),
          h('div', null,
            h('h4', null, '求职偏好'),
            h('div', { className: 'grid' },
              h('span', null, '求职类型'),
              h('select', { value: s.mode, onChange: (e) => set('mode', e.target.value) },
                h('option', { value: 'intern' }, '实习'), h('option', { value: 'full' }, '正式工作')),
              h('span', null, '目标城市'), text('cities', '如 深圳、武汉'),
              h('span', null, '期望薪资'), text('salary', '如 实习 150/天 或 8-12K'),
              h('span', null, '意向方向'), text('directions', '如 机器人、嵌入式'),
              h('span', null, '排除公司/行业'), text('excludes', '如 外包、销售'))),
          h('div', null,
            h('h4', null, '投递附言'),
            h('label', null, h('input', { type: 'checkbox', checked: s.footerEnabled, onChange: (e) => set('footerEnabled', e.target.checked) }), ' 在 AI 写的打招呼语末尾加上'),
            h('div', { style: { marginTop: 6 } }, text('footer', '附言'))),
          h('div', { style: { display: 'flex', gap: 10, alignItems: 'center' } },
            h('button', { className: 'primary', onClick: save }, '保存'),
            h('span', { className: 'hint' }, msg)),
          h('div', { className: 'hint' }, '设置文件：' + data.path))
      }

      const inject = ['slots']
      function apply(ctx) {
        const slots = ctx.get('slots')
        if (!slots) return
        slots.inject('settings.section', () => slots.register(
          { name: 'settings.section', id: 'job-desk', order: 30, label: '求职投递' }, () => h(Panel)))
        slots.inject('plugins.bundle.config', () => slots.register(
          { name: 'plugins.bundle.config', key: 'dsh-job-desk' }, () => h(Panel)))
      }
      exports.apply = apply
      exports.inject = inject
      return module.exports
    },
  }
})())
