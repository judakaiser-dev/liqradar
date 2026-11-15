/* LIQRADAR v26 — Mitteilungen (Push-Benachrichtigungen auf dem Gerät)
   Einstellbar unter Setup → Mitteilungen: ein/aus, Wal-Alarme samt Schwelle, eigene Alarme, Ruhezeiten.
   Mitteilungen kommen nur im Modus „Bybit Live" (keine Simulationsdaten). */
(function () {
  var WHALE_GAP_MS = 2 * 60 * 1000
  var lastWhale = 0

  function prefs() {
    var p = window.__lrPrefs && window.__lrPrefs.get()
    return (p && p.notify) || { on: true, whale: true, rule: true, quiet: false }
  }
  function supported() { return 'Notification' in window && 'serviceWorker' in navigator }
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }
  function isStandalone() {
    return window.navigator.standalone === true || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
  }
  function status() {
    if (!supported()) return isIOS() && !isStandalone() ? 'install' : 'unsupported'
    return Notification.permission // granted | denied | default
  }
  function inQuiet(n) {
    if (!n.quiet) return false
    function mins(s) { var p = String(s || '0:0').split(':'); return (+p[0]) * 60 + (+p[1] || 0) }
    var d = new Date(), now = d.getHours() * 60 + d.getMinutes(), a = mins(n.qFrom), b = mins(n.qTo)
    return a <= b ? now >= a && now < b : now >= a || now < b
  }

  function hint(text) {
    try {
      var el = document.createElement('div')
      el.textContent = text
      el.setAttribute('role', 'status')
      el.style.cssText =
        'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(84px + env(safe-area-inset-bottom));' +
        'z-index:9999;max-width:min(92vw,420px);padding:12px 14px;border-radius:10px;' +
        'background:#0d1424;color:#e6e9f0;border:1px solid #22d3ee55;font:500 13px/1.45 Inter,system-ui,sans-serif;' +
        'box-shadow:0 8px 30px rgba(0,0,0,.45);text-align:center'
      document.body.appendChild(el)
      setTimeout(function () { el.remove() }, 6500)
    } catch (e) {}
  }

  function ask() {
    var s = status()
    if (s === 'install') { hint('Für Mitteilungen auf dem iPhone/iPad: LIQRADAR über Teilen → „Zum Home-Bildschirm" installieren und von dort öffnen.'); return Promise.resolve(s) }
    if (s === 'unsupported') { hint('Dieser Browser unterstützt keine Mitteilungen.'); return Promise.resolve(s) }
    if (s === 'denied') { hint('Mitteilungen sind blockiert. Du kannst sie in den System-Einstellungen für LIQRADAR wieder erlauben.'); return Promise.resolve(s) }
    if (s === 'granted') return Promise.resolve(s)
    try {
      return Promise.resolve(Notification.requestPermission()).then(function (p) {
        if (p === 'granted') {
          hint('Mitteilungen aktiv: Wal-Alarme und eigene Alarme im Modus „Bybit Live".')
          show('LIQRADAR', 'Mitteilungen sind eingeschaltet.', 'lr-welcome')
        }
        return p
      })
    } catch (e) { return Promise.resolve('default') }
  }

  function show(title, body, tag) {
    if (status() !== 'granted') return false
    var opts = { body: body, tag: tag, icon: './icons/icon-192.png', badge: './icons/icon-192.png' }
    navigator.serviceWorker.ready
      .then(function (reg) { return reg.showNotification(title, opts) })
      .catch(function () { try { new Notification(title, opts) } catch (e) {} })
    return true
  }

  // Wird von der App aufgerufen, sobald ein Alarm ausgelöst wird.
  window.__lrNotify = function (alerts, mode) {
    var n = prefs()
    if (!n.on || mode !== 'live' || !alerts || !alerts.length || inQuiet(n)) return
    var now = Date.now()
    for (var i = 0; i < alerts.length; i++) {
      var a = alerts[i]
      if (a.kind === 'whale') {
        if (!n.whale || now - lastWhale < WHALE_GAP_MS) continue
        lastWhale = now
        show('🐋 ' + a.title, a.body, 'lr-whale')
      } else if (n.rule) {
        show('🔔 ' + a.title, a.body, 'lr-rule-' + now + '-' + i)
      }
    }
  }
  window.__lrNotifyApi = {
    status: status, ask: ask, inQuiet: function () { return inQuiet(prefs()) },
    test: function () {
      var s = status()
      if (s !== 'granted') return ask()
      show('🐋 Test: Wal-Alarm', 'So sieht eine LIQRADAR-Mitteilung aus. Alles eingerichtet.', 'lr-test')
      return Promise.resolve('granted')
    },
  }

  // Erlaubnis beim Tippen auf die Glocke (braucht eine echte Nutzer-Aktion)
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[aria-label^="Eigene Alarme"]')
    if (t && prefs().on && status() === 'default') ask()
  }, true)
})()
