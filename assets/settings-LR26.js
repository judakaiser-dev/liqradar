/* LIQRADAR v26 — Erweiterte Einstellungen (Setup-Reiter)
   Start & Daten · Mitteilungen · Geräte-Abgleich · Wartung */
(function () {
  'use strict'
  var TABS = [['dashboard', 'Dashboard'], ['kurse', 'Kurse'], ['heute', 'Heute'], ['chart', 'Chart'], ['heatmap', 'Heatmap']]
  var COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'ADA', 'LINK', 'AVAX', 'SUI']
  var WHALE = [1e6, 2e6, 5e6, 10e6, 25e6]
  var EXCLUDE = ['liqradar-lock-cred', 'liqradar-lock-enabled', 'liqradar-owner', 'liqradar-kurse-cache', 'liqradar-install-hint-dismissed']

  function P() { return window.__lrPrefs }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function setKey(key, patch) {
    try { var o = JSON.parse(localStorage.getItem(key) || '{}'); for (var k in patch) o[k] = patch[k]; localStorage.setItem(key, JSON.stringify(o)) } catch (e) {}
  }

  var CSS =
    '.lrs-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid var(--hairline)}' +
    '.lrs-row:last-child{border-bottom:0}' +
    '.lrs-row.wrap{flex-wrap:wrap}.lrs-seg button{min-width:34px}' +
    '.lrs-row .t{font-size:13px}.lrs-row .t small{display:block;margin-top:2px;font-size:11px;color:var(--text-muted);line-height:1.4}' +
    '.lrs-seg{display:flex;flex-wrap:wrap;border:1px solid var(--hairline);border-radius:5px;overflow:hidden;background:var(--panel-2);flex:0 0 auto}' +
    '.lrs-seg button{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;padding:6px 9px;border:0;background:transparent;color:var(--text-muted);cursor:pointer}' +
    '.lrs-seg button.on{color:var(--live);background:rgba(34,211,238,.12)}' +
    '.lrs-sel,.lrs-time{font-family:"JetBrains Mono",ui-monospace,monospace;height:32px;border-radius:5px;border:1px solid var(--hairline);background:var(--panel-2);color:var(--text);padding:0 8px;font-size:12px}' +
    '.lrs-time{width:84px}' +
    '.lrs-sw{position:relative;width:46px;height:28px;flex:0 0 46px;border-radius:14px;border:0;background:var(--hairline);cursor:pointer;transition:background .15s}' +
    '.lrs-sw::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:#fff;transition:transform .15s}' +
    '.lrs-sw.on{background:#22c55e}.lrs-sw.on::after{transform:translateX(18px)}' +
    '.lrs-sw:disabled{opacity:.45}' +
    '.lrs-btn{font-size:13px;font-weight:600;padding:9px 14px;border-radius:7px;border:1px solid var(--hairline);background:var(--panel-2);color:var(--live);cursor:pointer}' +
    '.lrs-btn.pri{background:rgba(34,211,238,.14);border-color:rgba(34,211,238,.45)}' +
    '.lrs-btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
    '.lrs-note{margin-top:8px;font-size:11px;line-height:1.5;color:var(--text-muted)}' +
    '.lrs-st{display:inline-block;margin-top:4px;padding:2px 7px;border-radius:4px;font-size:11px;font-family:"JetBrains Mono",ui-monospace,monospace}' +
    '.lrs-st.ok{background:rgba(74,222,128,.14);color:#4ade80}.lrs-st.warn{background:rgba(251,146,60,.14);color:#fb923c}.lrs-st.bad{background:rgba(248,113,113,.14);color:#f87171}' +
    '.lrs-msg{margin-top:8px;font-size:12px;color:#4ade80}.lrs-msg.err{color:#f87171}' +
    '.lrs-dis{opacity:.45;pointer-events:none}'

  function seg(name, items, cur) {
    return '<div class="lrs-seg" data-seg="' + name + '">' + items.map(function (it) {
      return '<button type="button" data-v="' + esc(it[0]) + '" class="' + (String(it[0]) === String(cur) ? 'on' : '') + '">' + esc(it[1]) + '</button>'
    }).join('') + '</div>'
  }
  function sw(name, on, disabled) {
    return '<button type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" class="lrs-sw' + (on ? ' on' : '') + '" data-sw="' + name + '"' + (disabled ? ' disabled' : '') + '></button>'
  }
  function row(title, sub, ctrl, cls) {
    return '<div class="lrs-row' + (cls ? ' ' + cls : '') + '"><div class="t">' + title + (sub ? '<small>' + sub + '</small>' : '') + '</div>' + ctrl + '</div>'
  }
  function section(id, title, body) {
    return '<section class="panel p-4" aria-labelledby="' + id + '"><h2 id="' + id + '" class="panel-title">' + title + '</h2><div class="mt-2">' + body + '</div></section>'
  }

  var msgs = {}
  function render(root) {
    var api = P()
    if (!api) { setTimeout(function () { render(root) }, 200); return }
    var p = api.get(), n = p.notify
    var nApi = window.__lrNotifyApi
    var ns = nApi ? nApi.status() : 'unsupported'
    var stHtml = ns === 'granted' ? '<span class="lrs-st ok">Erlaubt ✓</span>' :
      ns === 'denied' ? '<span class="lrs-st bad">Blockiert — in den iOS-/macOS-Einstellungen für LIQRADAR erlauben</span>' :
      ns === 'install' ? '<span class="lrs-st warn">Nur in der installierten App (Home-Bildschirm)</span>' :
      ns === 'unsupported' ? '<span class="lrs-st bad">Von diesem Browser nicht unterstützt</span>' :
      '<span class="lrs-st warn">Noch nicht erlaubt</span>'

    var html = ''
    // 1) Start & Daten
    html += section('lrs-start', 'Start &amp; Daten',
      row('Datenquelle beim Start', 'Womit das Dashboard öffnet. „Zuletzt“ merkt sich deine letzte Wahl.',
        seg('startMode', [['live', 'Live'], ['sim', 'Simulation'], ['last', 'Zuletzt']], p.startMode)) +
      row('Start-Reiter', 'Welcher Reiter beim Öffnen der App erscheint.',
        '<select class="lrs-sel" data-sel="startTab">' + TABS.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === p.startTab ? ' selected' : '') + '>' + t[1] + '</option>' }).join('') + '</select>') +
      row('Standard-Coin', 'Für Heatmap, Heute und Liquidations-Leiter.',
        '<select class="lrs-sel" data-sel="coin">' + COINS.map(function (c) { return '<option' + (c === p.coin ? ' selected' : '') + '>' + c + '</option>' }).join('') + '</select>') +
      row('Währung', 'Für den Reiter Kurse.', seg('cur', [['usd', 'USD'], ['eur', 'EUR']], p.cur)))

    // 2) Mitteilungen
    var off = !n.on
    html += section('lrs-notify', 'Mitteilungen',
      '<div class="lrs-note" style="margin-top:0">Status: ' + stHtml + '</div>' +
      row('Mitteilungen', 'Push-Nachrichten bei Alarmen im Modus „Bybit Live“.', sw('on', n.on)) +
      row('Wal-Alarme', 'Einzelne große Liquidation ab der gewählten Größe (höchstens alle 2 Min.).', sw('whale', n.whale, off), off ? 'lrs-dis' : '') +
      row('Schwelle Wal-Alarm', 'in Mio. $', seg('whaleMin', WHALE.map(function (v) { return [v, String(v / 1e6)] }), n.whaleMin), 'wrap' + (off || !n.whale ? ' lrs-dis' : '')) +
      row('Eigene Alarme', 'Deine Regeln aus der Glocke 🔔 im Dashboard.', sw('rule', n.rule, off), off ? 'lrs-dis' : '') +
      row('Ruhezeiten', 'In diesem Zeitraum keine Mitteilungen.', sw('quiet', n.quiet, off), off ? 'lrs-dis' : '') +
      row('Ruhe von – bis', '', '<span><input class="lrs-time" type="time" data-time="qFrom" value="' + esc(n.qFrom) + '"> – <input class="lrs-time" type="time" data-time="qTo" value="' + esc(n.qTo) + '"></span>', off || !n.quiet ? 'lrs-dis' : '') +
      '<div class="lrs-btns">' + (ns === 'default' ? '<button type="button" class="lrs-btn pri" data-act="allow">Mitteilungen erlauben</button>' : '') +
      '<button type="button" class="lrs-btn" data-act="test">Test-Mitteilung senden</button></div>' +
      (msgs.notify ? '<div class="lrs-msg">' + esc(msgs.notify) + '</div>' : '') +
      '<div class="lrs-note">Hinweis: Die App prüft die Daten selbst. Auf iPhone und iPad kommen Mitteilungen nur, solange LIQRADAR geöffnet ist bzw. kurz danach; am Mac auch im Hintergrund, solange die App läuft. Die Wal-Schwelle gilt auch für die Hinweise in der App.</div>')

    // 3) Geräte-Abgleich
    html += section('lrs-sync', 'Geräte-Abgleich',
      '<div class="lrs-note" style="margin-top:0">Sichert deine Alarme, Chart-Zeichnungen und alle Einstellungen in einer Datei. Auf dem anderen Gerät (iPhone, iPad, Mac) über „Sicherung laden“ übernehmen — am einfachsten per AirDrop. Die Face-ID-Sperre wird aus Sicherheitsgründen nicht übertragen.</div>' +
      '<div class="lrs-btns"><button type="button" class="lrs-btn pri" data-act="export">Sichern &amp; teilen</button>' +
      '<button type="button" class="lrs-btn" data-act="import">Sicherung laden</button>' +
      '<input type="file" accept="application/json,.json" data-file style="display:none"></div>' +
      (msgs.sync ? '<div class="lrs-msg' + (msgs.syncErr ? ' err' : '') + '">' + esc(msgs.sync) + '</div>' : ''))

    // 4) Wartung
    var keys = 0, bytes = 0
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('liqradar') === 0) { keys++; bytes += (localStorage.getItem(k) || '').length * 2 } } } catch (e) {}
    html += section('lrs-maint', 'Wartung',
      row('Version', 'LIQRADAR v' + esc(api.version) + ' · ' + keys + ' gespeicherte Einträge (' + Math.max(1, Math.round(bytes / 1024)) + ' KB)', '') +
      row('Aktualisierungs-Takt', 'Für Heatmap, Heute, Leiter und Kurse. „Akku sparen“ lädt 5× seltener.', seg('saver', [['0', 'Normal'], ['1', 'Akku sparen']], p.saver ? '1' : '0')) +
      '<div class="lrs-btns"><button type="button" class="lrs-btn pri" data-act="update">App aktualisieren</button></div>' +
      '<div class="lrs-note">Lädt die neueste Version vom Server, ohne deine Daten zu löschen — statt die App schließen und neu öffnen zu müssen.</div>')

    root.innerHTML = html
    bind(root)
  }

  function applyCoin(c) {
    ;['liqradar-heatmap', 'liqradar-daily', 'liqradar-ladder'].forEach(function (k) { setKey(k, { coin: c }) })
    if (window.__lrHeatmap) window.__lrHeatmap.state.coin = c
    if (window.__lrDaily) { window.__lrDaily.st.coin = c; window.__lrDaily.st.data = null }
    if (window.__lrLadder) { window.__lrLadder.coin = c; window.__lrLadder.data = null }
  }

  function bind(root) {
    var api = P()
    Array.prototype.forEach.call(root.querySelectorAll('[data-seg] button'), function (b) {
      b.addEventListener('click', function () {
        var name = b.parentNode.getAttribute('data-seg'), v = b.getAttribute('data-v')
        if (name === 'whaleMin') api.set({ notify: { whaleMin: +v } })
        else if (name === 'saver') api.set({ saver: v === '1' })
        else if (name === 'cur') { api.set({ cur: v }); setKey('liqradar-kurse', { cur: v }) }
        else { var o = {}; o[name] = v; api.set(o) }
        render(root)
      })
    })
    Array.prototype.forEach.call(root.querySelectorAll('[data-sel]'), function (s) {
      s.addEventListener('change', function () {
        var name = s.getAttribute('data-sel'), o = {}
        o[name] = s.value; api.set(o)
        if (name === 'coin') applyCoin(s.value)
        render(root)
      })
    })
    Array.prototype.forEach.call(root.querySelectorAll('[data-sw]'), function (b) {
      b.addEventListener('click', function () {
        var name = b.getAttribute('data-sw'), o = { notify: {} }
        o.notify[name] = !api.get().notify[name]
        api.set(o)
        if (name === 'on' && o.notify.on && window.__lrNotifyApi && window.__lrNotifyApi.status() === 'default') {
          window.__lrNotifyApi.ask().then(function () { render(root) })
        }
        render(root)
      })
    })
    Array.prototype.forEach.call(root.querySelectorAll('[data-time]'), function (inp) {
      inp.addEventListener('change', function () { var o = { notify: {} }; o.notify[inp.getAttribute('data-time')] = inp.value; api.set(o) })
    })
    var act = function (name, fn) { var b = root.querySelector('[data-act="' + name + '"]'); if (b) b.addEventListener('click', fn) }
    act('allow', function () { window.__lrNotifyApi && window.__lrNotifyApi.ask().then(function () { render(root) }) })
    act('test', function () {
      if (!window.__lrNotifyApi) return
      var s = window.__lrNotifyApi.status()
      window.__lrNotifyApi.test().then(function (r) {
        msgs.notify = r === 'granted' ? (s === 'granted' ? 'Test-Mitteilung gesendet.' : 'Erlaubt — tippe nochmal für den Test.') : ''
        render(root)
      })
    })
    act('export', function () { doExport(root) })
    act('import', function () { root.querySelector('[data-file]').click() })
    var file = root.querySelector('[data-file]')
    if (file) file.addEventListener('change', function () { if (file.files && file.files[0]) doImport(root, file.files[0]) })
    act('update', doUpdate)
  }

  function doExport(root) {
    var data = {}
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        if (k && k.indexOf('liqradar') === 0 && EXCLUDE.indexOf(k) < 0) data[k] = localStorage.getItem(k)
      }
    } catch (e) {}
    var d = new Date(), pad = function (x) { return (x < 10 ? '0' : '') + x }
    var name = 'LIQRADAR-Sicherung-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json'
    var json = JSON.stringify({ app: 'LIQRADAR', version: P().version, created: d.toISOString(), data: data }, null, 2)
    var blob = new Blob([json], { type: 'application/json' })
    var count = Object.keys(data).length
    var done = function (txt) { msgs.sync = txt; msgs.syncErr = false; render(root) }
    try {
      var f = new File([blob], name, { type: 'application/json' })
      if (navigator.canShare && navigator.canShare({ files: [f] })) {
        navigator.share({ files: [f], title: 'LIQRADAR-Sicherung' }).then(function () { done(count + ' Einträge gesichert und geteilt.') }, function () {})
        return
      }
    } catch (e) {}
    var url = URL.createObjectURL(blob), a = document.createElement('a')
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(function () { URL.revokeObjectURL(url) }, 5000)
    done(count + ' Einträge gesichert: ' + name)
  }

  function doImport(root, file) {
    var rd = new FileReader()
    rd.onload = function () {
      try {
        var j = JSON.parse(rd.result)
        if (!j || j.app !== 'LIQRADAR' || !j.data || typeof j.data !== 'object') throw new Error('Keine LIQRADAR-Sicherung.')
        var keys = Object.keys(j.data).filter(function (k) { return k.indexOf('liqradar') === 0 && EXCLUDE.indexOf(k) < 0 && typeof j.data[k] === 'string' })
        if (!keys.length) throw new Error('Die Sicherung ist leer.')
        var when = j.created ? new Date(j.created).toLocaleString('de-DE') : 'unbekannt'
        if (!confirm('Sicherung vom ' + when + ' mit ' + keys.length + ' Einträgen übernehmen?\nDeine aktuellen Alarme, Zeichnungen und Einstellungen auf diesem Gerät werden dabei ersetzt. Die App lädt danach neu.')) return
        keys.forEach(function (k) { localStorage.setItem(k, j.data[k]) })
        location.reload()
      } catch (e) {
        msgs.sync = 'Laden fehlgeschlagen: ' + (e && e.message || e); msgs.syncErr = true; render(root)
      }
    }
    rd.readAsText(file)
  }

  function doUpdate() {
    var go = function () { var u = new URL(location.href); u.searchParams.set('u', Date.now()); location.replace(u.toString()) }
    var jobs = []
    try {
      if ('serviceWorker' in navigator) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.update().catch(function () {}) })) }))
      if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k) })) }))
    } catch (e) {}
    Promise.all(jobs).then(go, go)
  }

  function scan() {
    var el = document.getElementById('lr-settings-root')
    if (el && !el.getAttribute('data-lrs')) {
      el.setAttribute('data-lrs', '1')
      if (!document.getElementById('lrs-style')) { var s = document.createElement('style'); s.id = 'lrs-style'; s.textContent = CSS; document.head.appendChild(s) }
      msgs = {}
      render(el)
    }
  }
  function start() { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
