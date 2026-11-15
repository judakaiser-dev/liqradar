/* LIQRADAR v19 — Mitteilungen (Push-Benachrichtigungen auf dem Gerät)
   - Erlaubnis wird beim ersten Tippen auf die Glocke (Eigene Alarme) abgefragt.
   - Mitteilungen kommen nur im Modus „Bybit Live" (keine Simulationsdaten).
   - Wal-Alarme höchstens alle 2 Minuten, eigene Alarme wie in der App (Sperre 60 s). */
(function () {
  var WHALE_GAP_MS = 2 * 60 * 1000
  var lastWhale = 0

  function supported() {
    return 'Notification' in window && 'serviceWorker' in navigator
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  }

  function isStandalone() {
    return window.navigator.standalone === true ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
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
    if (!supported()) {
      if (isIOS() && !isStandalone()) {
        hint('Für Mitteilungen auf dem iPhone/iPad: LIQRADAR über Teilen → „Zum Home-Bildschirm" installieren und von dort öffnen.')
      } else {
        hint('Dieser Browser unterstützt keine Mitteilungen.')
      }
      return
    }
    if (Notification.permission === 'granted') return
    if (Notification.permission === 'denied') {
      hint('Mitteilungen sind blockiert. Du kannst sie in den System-Einstellungen für LIQRADAR wieder erlauben.')
      return
    }
    try {
      Notification.requestPermission().then(function (p) {
        if (p === 'granted') {
          hint('Mitteilungen aktiv: Du bekommst Wal-Alarme und deine eigenen Alarme im Modus „Bybit Live".')
          show('LIQRADAR', 'Mitteilungen sind eingeschaltet.', 'lr-welcome')
        }
      })
    } catch (e) {}
  }

  function show(title, body, tag) {
    if (!supported() || Notification.permission !== 'granted') return
    var opts = {
      body: body,
      tag: tag,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
    }
    navigator.serviceWorker.ready
      .then(function (reg) { return reg.showNotification(title, opts) })
      .catch(function () {
        try { new Notification(title, opts) } catch (e) {}
      })
  }

  // Wird von der App aufgerufen, sobald ein Alarm ausgelöst wird.
  window.__lrNotify = function (alerts, mode) {
    if (mode !== 'live' || !alerts || !alerts.length) return
    var now = Date.now()
    for (var i = 0; i < alerts.length; i++) {
      var a = alerts[i]
      if (a.kind === 'whale') {
        if (now - lastWhale < WHALE_GAP_MS) continue
        lastWhale = now
        show('🐋 ' + a.title, a.body, 'lr-whale')
      } else {
        show('🔔 ' + a.title, a.body, 'lr-rule-' + now + '-' + i)
      }
    }
  }

  // Erlaubnis beim Tippen auf die Glocke (braucht eine echte Nutzer-Aktion)
  document.addEventListener(
    'click',
    function (e) {
      var t = e.target && e.target.closest && e.target.closest('[aria-label^="Eigene Alarme"]')
      if (t) ask()
    },
    true,
  )
})()
