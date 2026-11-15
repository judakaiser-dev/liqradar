/* LIQRADAR v26 — Grundeinstellungen (wird vor der App geladen) */
(function () {
  'use strict'
  var VERSION = '26'
  var KEY = 'liqradar-prefs'
  var DEF = {
    startMode: 'live', // live | sim | last
    startTab: 'dashboard',
    coin: 'BTC',
    cur: 'usd',
    saver: false,
    notify: { on: true, whale: true, whaleMin: 5e6, rule: true, quiet: false, qFrom: '22:00', qTo: '07:00' },
  }
  function merge(a, b) {
    var o = {}
    for (var k in a) {
      if (a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) o[k] = merge(a[k], (b && b[k]) || {})
      else o[k] = b && b[k] !== undefined ? b[k] : a[k]
    }
    return o
  }
  var prefs = DEF
  try { prefs = merge(DEF, JSON.parse(localStorage.getItem(KEY) || '{}')) } catch (e) {}

  window.__lrPrefs = {
    version: VERSION,
    get: function () { return prefs },
    set: function (patch) {
      prefs = merge(prefs, patch)
      try { localStorage.setItem(KEY, JSON.stringify(prefs)) } catch (e) {}
      window.__lrWhaleMin = prefs.notify.whaleMin
      return prefs
    },
    defaults: DEF,
  }
  window.__lrWhaleMin = prefs.notify.whaleMin

  // Startmodus für das Dashboard (wird von der App beim Öffnen gelesen)
  window.__lrStartMode = function () {
    try { var sm = sessionStorage.getItem('lr-mode'); if (sm === 'live' || sm === 'sim') return sm } catch (e) {}
    var m = prefs.startMode
    if (m === 'last') { try { m = localStorage.getItem('liqradar-mode-last') || 'sim' } catch (e) { m = 'sim' } }
    return m === 'live' ? 'live' : 'sim'
  }

  // Start-Reiter beim ersten Öffnen der App
  try {
    if (!sessionStorage.getItem('lr-started')) {
      sessionStorage.setItem('lr-started', '1')
      var h = location.hash.replace(/^#\/?/, '')
      if (!h && prefs.startTab && prefs.startTab !== 'dashboard') history.replaceState(null, '', '#' + prefs.startTab)
    }
  } catch (e) {}

  // Aktualisierungs-Takt (Akku sparen = 5× seltener)
  var last = {}
  window.__lrShouldRefresh = function (id, baseMs) {
    var f = prefs.saver ? 5 : 1, now = Date.now()
    if (last[id] && now - last[id] < baseMs * f - 2000) return false
    last[id] = now
    return true
  }
})()
