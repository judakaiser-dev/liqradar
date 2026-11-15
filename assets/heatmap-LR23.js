/* LIQRADAR v20 — Reiter „Heatmap"
   1) Zeit×Preis-Liquidations-Heatmap (geschätzte Liquidationsniveaus, wie coinperps)
   2) Börsen-Liquidationskarte (gestapelt je Börse + kumulierte Long/Short-Linien, wie Coinglass/Kingfisher)
   Daten: öffentliche Kerzen von Binance, Bybit, Hyperliquid — direkt im Browser, kein Server, keine KI.
   Modell: Pro Kerze wird ein Teil des Volumens als neu eröffnete gehebelte Positionen angenommen
   (10x/25x/50x/100x). Daraus entstehen Liquidationsniveaus, die bestehen bleiben, bis der Kurs sie
   erreicht; ältere Positionen werden mit der Zeit abgebaut. Schätzung, keine echten Positionsdaten. */
(function () {
  'use strict'

  var COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'ADA', 'LINK', 'AVAX', 'SUI']
  var EXCHANGES = [
    { key: 'binance', label: 'Binance', color: '#f59e0b' },
    { key: 'bybit', label: 'Bybit', color: '#38bdf8' },
    { key: 'hyperliquid', label: 'Hyperliquid', color: '#34d399' },
  ]
  var H = 3600e3, D = 24 * H
  var IV_MS = { '5m': 5 * 60e3, '15m': 15 * 60e3, '30m': 30 * 60e3, '1h': H, '2h': 2 * H, '12h': 12 * H, '1d': D }
  var IV_LABEL = { '5m': '5-Minuten-Kerzen', '15m': '15-Minuten-Kerzen', '30m': '30-Minuten-Kerzen', '1h': 'Stunden-Kerzen', '2h': '2-Stunden-Kerzen', '12h': '12-Stunden-Kerzen', '1d': 'Tageskerzen' }
  var BYBIT_IV = { '5m': '5', '15m': '15', '30m': '30', '1h': '60', '2h': '120', '12h': '720', '1d': 'D' }
  var TFS = [
    { key: '12h', label: '12H', long: '12 Stunden', ms: 12 * H, iv: '5m', range: 0.06 },
    { key: '24h', label: '24H', long: '24 Stunden', ms: D, iv: '5m', range: 0.08 },
    { key: '3d', label: '3D', long: '3 Tage', ms: 3 * D, iv: '15m', range: 0.12 },
    { key: '7d', label: '7D', long: '7 Tage', ms: 7 * D, iv: '30m', range: 0.16 },
    { key: '30d', label: '30D', long: '30 Tage', ms: 30 * D, iv: '2h', range: 0.25 },
    { key: '90d', label: '90D', long: '90 Tage', ms: 90 * D, iv: '12h', range: 0.35 },
    { key: '180d', label: '180D', long: '180 Tage', ms: 180 * D, iv: '1d', range: 0.45 },
    { key: '1y', label: '1J', long: '1 Jahr', ms: 365 * D, iv: '1d', range: 0.5 },
  ]
  var TF_EXTRA = [{ key: '14d', label: '14D', long: '14 Tage', ms: 14 * D, iv: '1h', range: 0.2 }]
  var MAP_TFS = [
    { key: '1d', label: '1 Tag', tf: '24h' },
    { key: '1w', label: '1 Woche', tf: '7d' },
    { key: '2w', label: '2 Wochen', tf: '14d' },
    { key: '1m', label: '1 Monat', tf: '30d' },
  ]
  function tfByKey(k) { return TFS.concat(TF_EXTRA).filter(function (t) { return t.key === k })[0] }
  // typische Hebel-Verteilung neuer Positionen
  var TIERS = [
    { lev: 10, w: 0.3 },
    { lev: 25, w: 0.3 },
    { lev: 50, w: 0.25 },
    { lev: 100, w: 0.15 },
  ]
  var MMR = 0.005 // Erhaltungsmarge
  var FRESH = 0.08 // Anteil des Volumens, der als neue gehebelte Position zählt
  var MOVES = [5, 3, 2, 1]
  var REFRESH_MS = 60e3

  var state = {
    coin: 'BTC',
    ex: 'binance',
    tf: '24h',
    mapTf: '1w',
    mapData: {},
    mapLoading: false,
    data: {}, // ex -> {candles, levels, err}
    loading: false,
    updated: null,
    hoverHeat: null,
    hoverMap: null,
  }
  try {
    var saved = JSON.parse(localStorage.getItem('liqradar-heatmap') || '{}')
    if (COINS.indexOf(saved.coin) >= 0) state.coin = saved.coin
    if (saved.ex === 'all' || EXCHANGES.some(function (e) { return e.key === saved.ex })) state.ex = saved.ex
    if (TFS.some(function (t) { return t.key === saved.tf })) state.tf = saved.tf
    if (MAP_TFS.some(function (t) { return t.key === saved.mapTf })) state.mapTf = saved.mapTf
  } catch (e) {}

  function save() {
    try { localStorage.setItem('liqradar-heatmap', JSON.stringify({ coin: state.coin, ex: state.ex, tf: state.tf, mapTf: state.mapTf })) } catch (e) {}
  }
  function tfObj() { return TFS.filter(function (t) { return t.key === state.tf })[0] }
  function mapTfObj() { return tfByKey(MAP_TFS.filter(function (t) { return t.key === state.mapTf })[0].tf) }

  /* ---------- Formatierung ---------- */
  var nf0 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 })
  var nf1 = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  function fmtUsd(v) {
    if (!isFinite(v)) return '–'
    var a = Math.abs(v)
    if (a >= 1e9) return nf1.format(v / 1e9) + ' Mrd. $'
    if (a >= 1e6) return nf1.format(v / 1e6) + ' Mio. $'
    if (a >= 1e3) return nf0.format(v / 1e3) + ' Tsd. $'
    return nf0.format(v) + ' $'
  }
  function fmtUsdShort(v) {
    var a = Math.abs(v)
    if (a >= 1e9) return '$' + (v / 1e9).toFixed(a >= 1e10 ? 0 : 1) + 'B'
    if (a >= 1e6) return '$' + (v / 1e6).toFixed(a >= 1e8 ? 0 : 1) + 'M'
    if (a >= 1e3) return '$' + (v / 1e3).toFixed(0) + 'K'
    return '$' + v.toFixed(0)
  }
  function priceDigits(p) {
    if (p >= 1000) return 0
    if (p >= 100) return 1
    if (p >= 1) return 3
    return 5
  }
  function fmtPrice(p, ref) {
    var d = priceDigits(ref || p)
    return new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }).format(p)
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n }
  function fmtTime(t, tf) {
    var d = new Date(t)
    if (tf.ms <= 3 * D) return pad2(d.getHours()) + ':' + pad2(d.getMinutes())
    if (tf.ms <= 30 * D) return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.'
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + String(d.getFullYear()).slice(2)
  }
  function fmtDateTime(t) {
    var d = new Date(t)
    return pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '. ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes())
  }

  /* ---------- Daten holen ---------- */
  var cache = {}
  function fetchJson(url, opts) {
    var ctrl = 'AbortController' in window ? new AbortController() : null
    var timer = ctrl ? setTimeout(function () { ctrl.abort() }, 15000) : null
    var o = opts || {}
    if (ctrl) o.signal = ctrl.signal
    return fetch(url, o).then(function (r) {
      if (timer) clearTimeout(timer)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    })
  }
  function fetchCandles(ex, coin, iv, count) {
    var key = ex + '|' + coin + '|' + iv + '|' + count
    var c = cache[key]
    if (c && Date.now() - c.at < 50e3) return Promise.resolve(c.candles)
    var p
    if (ex === 'bybit') {
      p = fetchJson('https://api.bybit.com/v5/market/kline?category=linear&symbol=' + coin + 'USDT&interval=' + BYBIT_IV[iv] + '&limit=' + Math.min(1000, count))
        .then(function (j) {
          if (!j || j.retCode !== 0 || !j.result || !j.result.list || !j.result.list.length) throw new Error('keine Daten')
          return j.result.list.map(function (r) {
            return { t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], qv: +r[6] }
          }).reverse()
        })
    } else if (ex === 'binance') {
      p = fetchJson('https://fapi.binance.com/fapi/v1/klines?symbol=' + coin + 'USDT&interval=' + iv + '&limit=' + Math.min(1500, count))
        .then(function (j) {
          if (!Array.isArray(j) || !j.length) throw new Error('keine Daten')
          return j.map(function (r) { return { t: +r[0], o: +r[1], h: +r[2], l: +r[3], c: +r[4], qv: +r[7] } })
        })
    } else {
      var end = Date.now()
      p = fetchJson('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'candleSnapshot', req: { coin: coin, interval: iv, startTime: end - count * IV_MS[iv], endTime: end } }),
      }).then(function (j) {
        if (!Array.isArray(j) || !j.length) throw new Error('keine Daten')
        return j.map(function (r) {
          var h = +r.h, l = +r.l, cl = +r.c
          return { t: +r.t, o: +r.o, h: h, l: l, c: cl, qv: +r.v * (h + l + cl) / 3 }
        })
      })
    }
    return p.then(function (candles) {
      candles = candles.filter(function (k) { return isFinite(k.h) && isFinite(k.l) && k.h > 0 })
      cache[key] = { at: Date.now(), candles: candles }
      return candles
    })
  }

  /* ---------- Schätzmodell ---------- */
  // liefert Liquidationsniveaus mit Entstehungs- und Auflösungszeitpunkt
  function buildLevels(candles, tf) {
    var ivMs = IV_MS[tf.iv]
    var halfLife = Math.min(60 * D, Math.max(D, tf.ms * 0.25))
    var decayPerCandle = Math.pow(0.5, ivMs / halfLife)
    var lp = [], la = [], ls = [], lb = [], ld = [] // Preis, Betrag, Seite(1 Long / -1 Short), geboren(t), aufgelöst(t|0)
    var aliveLong = [], aliveShort = []
    for (var i = 0; i < candles.length; i++) {
      var k = candles[i]
      // Treffer prüfen (vor neuen Niveaus dieser Kerze)
      var nl = []
      for (var a = 0; a < aliveLong.length; a++) {
        var id = aliveLong[a]
        if (k.l <= lp[id]) ld[id] = k.t
        else nl.push(id)
      }
      aliveLong = nl
      var ns = []
      for (var b = 0; b < aliveShort.length; b++) {
        var id2 = aliveShort[b]
        if (k.h >= lp[id2]) ld[id2] = k.t
        else ns.push(id2)
      }
      aliveShort = ns
      // neue Positionen aus dieser Kerze
      var base = (k.h + k.l + k.c) / 3
      var notional = (k.qv || 0) * FRESH
      if (!(notional > 0)) continue
      for (var t = 0; t < TIERS.length; t++) {
        var lev = TIERS[t].lev, amt = notional * TIERS[t].w * 0.5
        var idL = lp.length
        lp.push(base * (1 - 1 / lev + MMR)); la.push(amt); ls.push(1); lb.push(k.t); ld.push(0)
        aliveLong.push(idL)
        var idS = lp.length
        lp.push(base * (1 + 1 / lev - MMR)); la.push(amt); ls.push(-1); lb.push(k.t); ld.push(0)
        aliveShort.push(idS)
      }
    }
    return { p: lp, a: la, s: ls, b: lb, d: ld, decay: decayPerCandle, ivMs: ivMs, last: candles.length ? candles[candles.length - 1] : null }
  }
  function amountAt(L, i, t) {
    return L.a[i] * Math.pow(L.decay, Math.max(0, (t - L.b[i]) / L.ivMs))
  }
  // aktive Niveaus zum letzten Zeitpunkt
  function activeLevels(L) {
    var out = []
    if (!L.last) return out
    var t = L.last.t
    for (var i = 0; i < L.p.length; i++) {
      if (L.d[i]) continue
      out.push({ p: L.p[i], s: L.s[i], a: amountAt(L, i, t) })
    }
    return out
  }

  function selectedExchanges() {
    return state.ex === 'all' ? EXCHANGES.map(function (e) { return e.key }) : [state.ex]
  }
  function refCandles(keys) {
    for (var i = 0; i < keys.length; i++) {
      var d = state.data[keys[i]]
      if (d && d.candles && d.candles.length) return d.candles
    }
    return null
  }

  /* ---------- Farben ---------- */
  var STOPS = [
    [0.0, [16, 32, 74]],
    [0.25, [30, 80, 140]],
    [0.5, [32, 160, 150]],
    [0.75, [120, 210, 80]],
    [1.0, [253, 231, 37]],
  ]
  function cmap(t) {
    for (var i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) {
        var a = STOPS[i - 1], b = STOPS[i], f = (t - a[0]) / (b[0] - a[0])
        return [a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f, a[1][2] + (b[1][2] - a[1][2]) * f]
      }
    }
    return STOPS[STOPS.length - 1][1]
  }
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  }
  function niceStep(range, n) {
    var raw = range / n, pow = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / pow
    var s = m < 1.5 ? 1 : m < 2.25 ? 2 : m < 3.5 ? 2.5 : m < 7.5 ? 5 : 10
    return s * pow
  }
  function setupCanvas(cv, w, h) {
    var dpr = Math.min(3, window.devicePixelRatio || 1)
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
      cv.style.width = w + 'px'; cv.style.height = h + 'px'
    }
    var ctx = cv.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    return ctx
  }

  /* ---------- Heatmap zeichnen ---------- */
  var heatModel = null
  function computeHeat() {
    heatModel = null
    var tf = tfObj(), keys = selectedExchanges()
    var ref = refCandles(keys)
    if (!ref) return
    var cols = Math.round(tf.ms / IV_MS[tf.iv])
    var vis = ref.slice(-cols)
    if (vis.length < 5) return
    var t0 = vis[0].t, ivMs = IV_MS[tf.iv], nCols = vis.length, tEnd = vis[nCols - 1].t
    var lo = Infinity, hi = -Infinity
    for (var i = 0; i < nCols; i++) { if (vis[i].l < lo) lo = vis[i].l; if (vis[i].h > hi) hi = vis[i].h }
    var last = vis[nCols - 1].c
    var padv = (hi - lo) * 0.25 + last * 0.006
    lo -= padv; hi += padv
    var bins = 240
    var grid = new Float32Array(nCols * bins)
    var prof = new Float32Array(bins)
    var activeAll = []
    keys.forEach(function (k) {
      var d = state.data[k]
      if (!d || !d.levels) return
      var L = d.levels
      for (var i = 0; i < L.p.length; i++) {
        var p = L.p[i]
        if (p < lo || p >= hi) continue
        var bin = Math.floor((hi - p) / (hi - lo) * bins)
        var cStart = Math.max(0, Math.round((L.b[i] - t0) / ivMs))
        var cEnd = L.d[i] ? Math.round((L.d[i] - t0) / ivMs) : nCols
        if (cEnd <= 0 || cStart >= nCols) continue
        cEnd = Math.min(nCols, cEnd)
        var age0 = (t0 + cStart * ivMs - L.b[i]) / ivMs
        var amt = L.a[i] * Math.pow(L.decay, Math.max(0, age0))
        for (var c = cStart; c < cEnd; c++) {
          grid[c * bins + bin] += amt
          amt *= L.decay
        }
        if (!L.d[i]) prof[bin] += L.a[i] * Math.pow(L.decay, Math.max(0, (tEnd - L.b[i]) / ivMs))
      }
      activeAll = activeAll.concat(activeLevels(L))
    })
    // Normierung über hohes Perzentil
    var sample = []
    var step = Math.max(1, Math.floor(grid.length / 40000))
    for (var g = 0; g < grid.length; g += step) if (grid[g] > 0) sample.push(grid[g])
    sample.sort(function (a, b) { return a - b })
    var vmax = sample.length ? sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.997))] : 1
    heatModel = { tf: tf, vis: vis, t0: t0, ivMs: ivMs, nCols: nCols, lo: lo, hi: hi, bins: bins, grid: grid, prof: prof, vmax: vmax, last: last, active: activeAll }
  }

  function drawHeat(ui) {
    var cv = ui.heatCanvas, wrap = ui.heatWrap
    var w = Math.max(280, wrap.clientWidth)
    var h = Math.round(Math.max(340, Math.min(560, w * 0.95)))
    var ctx = setupCanvas(cv, w, h)
    var muted = cssVar('--text-muted', '#8a93a6'), hair = cssVar('--hairline', '#1c2333')
    var M = heatModel
    if (!M) {
      ctx.fillStyle = muted; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(state.loading ? 'Lade Kursdaten …' : 'Keine Daten für diese Auswahl.', w / 2, h / 2)
      return
    }
    var profW = w < 520 ? 34 : 64, axisW = w < 520 ? 52 : 64, top = 8, bottom = 22
    var cw = w - profW - axisW - 4, ch = h - top - bottom
    var x0 = 0, y0 = top
    function yOf(p) { return y0 + (M.hi - p) / (M.hi - M.lo) * ch }
    function xOfCol(c) { return x0 + (c + 0.5) / M.nCols * cw }

    // Heatmap-Bild
    var off = document.createElement('canvas')
    off.width = M.nCols; off.height = M.bins
    var octx = off.getContext('2d'), img = octx.createImageData(M.nCols, M.bins)
    for (var c = 0; c < M.nCols; c++) {
      for (var b = 0; b < M.bins; b++) {
        var v = M.grid[c * M.bins + b]
        if (v <= 0) continue
        var t = Math.pow(Math.min(1, v / M.vmax), 0.85)
        if (t < 0.03) continue
        var col = cmap(t), idx = (b * M.nCols + c) * 4
        img.data[idx] = col[0]; img.data[idx + 1] = col[1]; img.data[idx + 2] = col[2]
        img.data[idx + 3] = Math.round(255 * Math.min(1, 0.22 + t * 1.1))
      }
    }
    octx.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(off, x0, y0, cw, ch)
    ctx.imageSmoothingEnabled = true

    // Gitter + Preisachse
    var step = niceStep(M.hi - M.lo, 6)
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    for (var p = Math.ceil(M.lo / step) * step; p < M.hi; p += step) {
      var y = yOf(p)
      ctx.strokeStyle = hair; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + cw, y); ctx.stroke(); ctx.globalAlpha = 1
      ctx.fillStyle = muted; ctx.fillText(fmtPrice(p, M.last), x0 + cw + 4, y)
    }

    // Kerzen
    var bw = Math.max(1, cw / M.nCols * 0.62)
    for (var i = 0; i < M.nCols; i++) {
      var k = M.vis[i], x = xOfCol(i), up = k.c >= k.o
      ctx.strokeStyle = ctx.fillStyle = up ? '#22c55e' : '#ef4444'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, yOf(k.h)); ctx.lineTo(x, yOf(k.l)); ctx.stroke()
      var yo = yOf(k.o), yc = yOf(k.c)
      ctx.fillRect(x - bw / 2, Math.min(yo, yc), bw, Math.max(1, Math.abs(yc - yo)))
    }

    // aktueller Preis
    var yl = yOf(M.last)
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x0, yl); ctx.lineTo(x0 + cw, yl); ctx.stroke(); ctx.setLineDash([])
    var lbl = fmtPrice(M.last, M.last)
    ctx.font = 'bold 10px "JetBrains Mono", ui-monospace, monospace'
    var lw = ctx.measureText(lbl).width + 8
    ctx.fillStyle = '#f97316'; roundRect(ctx, x0 + cw + 2, yl - 8, Math.min(lw, axisW - 2), 16, 3); ctx.fill()
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(lbl, x0 + cw + 6, yl)

    // Profil rechts (aktive Niveaus): oberhalb Short (rot), unterhalb Long (grün)
    var pmax = 0
    for (var q = 0; q < M.bins; q++) if (M.prof[q] > pmax) pmax = M.prof[q]
    var px = w - profW, binH = ch / M.bins
    if (pmax > 0) {
      for (var r = 0; r < M.bins; r++) {
        var pv = M.prof[r]
        if (pv <= 0) continue
        var len = Math.max(1, pv / pmax * (profW - 4))
        var yb = y0 + r * binH
        var price = M.hi - (r + 0.5) / M.bins * (M.hi - M.lo)
        ctx.fillStyle = price > M.last ? 'rgba(239,68,68,0.85)' : 'rgba(34,197,94,0.85)'
        ctx.fillRect(px + 2, yb, len, Math.max(1, binH * 0.8))
      }
    }

    // Zeitachse
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace'; ctx.fillStyle = muted; ctx.textBaseline = 'alphabetic'
    var nLab = w < 520 ? 4 : 7
    for (var j = 0; j <= nLab; j++) {
      var cc = Math.round(j / nLab * (M.nCols - 1))
      var tx = xOfCol(cc)
      ctx.textAlign = j === 0 ? 'left' : j === nLab ? 'right' : 'center'
      ctx.fillText(fmtTime(M.vis[cc].t, M.tf), j === 0 ? x0 : j === nLab ? x0 + cw : tx, h - 6)
    }

    // Fadenkreuz
    var hv = state.hoverHeat
    if (hv && hv.x >= x0 && hv.x <= x0 + cw && hv.y >= y0 && hv.y <= y0 + ch) {
      var colI = Math.max(0, Math.min(M.nCols - 1, Math.floor((hv.x - x0) / cw * M.nCols)))
      var binI = Math.max(0, Math.min(M.bins - 1, Math.floor((hv.y - y0) / ch * M.bins)))
      var hp = M.hi - (hv.y - y0) / ch * (M.hi - M.lo)
      var val = M.grid[colI * M.bins + binI]
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(hv.x, y0); ctx.lineTo(hv.x, y0 + ch); ctx.moveTo(x0, hv.y); ctx.lineTo(x0 + cw, hv.y); ctx.stroke()
      var k2 = M.vis[colI]
      var lines = [fmtDateTime(k2.t), 'Preis ' + fmtPrice(hp, M.last), 'Liq. ≈ ' + fmtUsd(val), 'Kerze S ' + fmtPrice(k2.c, M.last)]
      tooltip(ctx, lines, hv.x, hv.y, x0, y0, cw, ch)
    }
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath()
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath()
  }
  function tooltip(ctx, lines, x, y, x0, y0, cw, ch, colors) {
    ctx.font = '11px "JetBrains Mono", ui-monospace, monospace'
    var tw = 0
    lines.forEach(function (l) { tw = Math.max(tw, ctx.measureText(l).width) })
    var bw = tw + 16 + (colors ? 12 : 0), bh = lines.length * 16 + 10
    var bx = x + 12, by = y + 12
    if (bx + bw > x0 + cw) bx = x - 12 - bw
    if (by + bh > y0 + ch) by = y - 12 - bh
    if (bx < x0) bx = x0 + 2
    if (by < y0) by = y0 + 2
    ctx.fillStyle = 'rgba(8,12,22,0.92)'; ctx.strokeStyle = 'rgba(34,211,238,0.45)'
    roundRect(ctx, bx, by, bw, bh, 6); ctx.fill(); ctx.stroke()
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    lines.forEach(function (l, i) {
      var ly = by + 13 + i * 16, lx = bx + 8
      if (colors && colors[i]) { ctx.fillStyle = colors[i]; ctx.fillRect(lx, ly - 4, 8, 8); lx += 12 }
      ctx.fillStyle = i === 0 ? '#9fb0c8' : '#e6e9f0'
      ctx.fillText(l, lx, ly)
    })
  }

  /* ---------- Börsen-Liquidationskarte ---------- */
  var mapModel = null
  function computeMap() {
    mapModel = null
    var tf = mapTfObj()
    var ref = null
    ;['binance', 'bybit', 'hyperliquid'].forEach(function (k) { var d = state.mapData[k]; if (!ref && d && d.candles && d.candles.length) ref = d.candles })
    if (!ref) return
    var P = ref[ref.length - 1].c
    var lo = P * (1 - tf.range), hi = P * (1 + tf.range)
    var bins = 90
    var per = {}, any = false
    EXCHANGES.forEach(function (e) {
      var d = state.mapData[e.key]
      if (!d || !d.levels) return
      any = true
      var arr = new Float64Array(bins)
      var act = activeLevels(d.levels)
      for (var i = 0; i < act.length; i++) {
        var p = act[i].p
        if (p < lo || p >= hi) continue
        arr[Math.floor((p - lo) / (hi - lo) * bins)] += act[i].a
      }
      per[e.key] = arr
    })
    if (!any) return
    var tot = new Float64Array(bins)
    EXCHANGES.forEach(function (e) { if (per[e.key]) for (var i = 0; i < bins; i++) tot[i] += per[e.key][i] })
    var pBin = Math.floor((P - lo) / (hi - lo) * bins)
    var cumL = new Float64Array(bins), cumS = new Float64Array(bins)
    var acc = 0
    for (var i = pBin; i >= 0; i--) { acc += tot[i]; cumL[i] = acc }
    acc = 0
    for (var j = pBin; j < bins; j++) { acc += tot[j]; cumS[j] = acc }
    var longTotal = 0, shortTotal = 0
    for (var q = 0; q < bins; q++) { if (q <= pBin) longTotal += tot[q]; else shortTotal += tot[q] }
    mapModel = { tf: tf, P: P, lo: lo, hi: hi, bins: bins, per: per, tot: tot, cumL: cumL, cumS: cumS, pBin: pBin, longTotal: longTotal, shortTotal: shortTotal }
  }

  function drawMap(ui) {
    var cv = ui.mapCanvas, wrap = ui.mapWrap
    var w = Math.max(280, wrap.clientWidth)
    var h = Math.round(Math.max(300, Math.min(440, w * 0.75)))
    var ctx = setupCanvas(cv, w, h)
    var muted = cssVar('--text-muted', '#8a93a6'), hair = cssVar('--hairline', '#1c2333')
    var M = mapModel
    if (!M) {
      ctx.fillStyle = muted; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(state.mapLoading ? 'Lade Kursdaten …' : 'Keine Daten.', w / 2, h / 2)
      return
    }
    var axL = w < 520 ? 46 : 58, axR = w < 520 ? 46 : 58, top = 24, bottom = 22
    var cw = w - axL - axR, ch = h - top - bottom, x0 = axL, y0 = top
    var maxBar = 0, maxCum = 0
    for (var i = 0; i < M.bins; i++) { if (M.tot[i] > maxBar) maxBar = M.tot[i]; maxCum = Math.max(maxCum, M.cumL[i], M.cumS[i]) }
    maxBar = maxBar || 1; maxCum = maxCum || 1
    var bwid = cw / M.bins
    function xOfBin(b) { return x0 + b * bwid }
    function xOfP(p) { return x0 + (p - M.lo) / (M.hi - M.lo) * cw }

    // Hintergrund-Flächen
    var px = xOfP(M.P)
    ctx.fillStyle = 'rgba(56,189,248,0.06)'; ctx.fillRect(x0, y0, px - x0, ch)
    ctx.fillStyle = 'rgba(239,68,68,0.06)'; ctx.fillRect(px, y0, x0 + cw - px, ch)

    // Achsen-Gitter
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace'; ctx.textBaseline = 'middle'
    for (var g = 0; g <= 4; g++) {
      var yy = y0 + ch - g / 4 * ch
      ctx.strokeStyle = hair; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + cw, yy); ctx.stroke(); ctx.globalAlpha = 1
      ctx.fillStyle = muted
      ctx.textAlign = 'right'; ctx.fillText(fmtUsdShort(maxBar * g / 4), x0 - 4, yy)
      ctx.textAlign = 'left'; ctx.fillText(fmtUsdShort(maxCum * g / 4), x0 + cw + 4, yy)
    }

    // gestapelte Balken je Börse
    for (var b = 0; b < M.bins; b++) {
      var yb = y0 + ch
      EXCHANGES.forEach(function (e) {
        var arr = M.per[e.key]
        if (!arr || arr[b] <= 0) return
        var hh = arr[b] / maxBar * ch
        ctx.fillStyle = e.color
        ctx.fillRect(xOfBin(b) + bwid * 0.12, yb - hh, Math.max(1, bwid * 0.76), hh)
        yb -= hh
      })
    }

    // kumulierte Linien
    function line(arr, from, to, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath()
      var first = true
      for (var i = from; i <= to; i++) {
        var x = xOfBin(i) + bwid / 2, y = y0 + ch - arr[i] / maxCum * ch
        if (first) { ctx.moveTo(x, y); first = false } else ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
    line(M.cumL, 0, M.pBin, '#f87171')
    line(M.cumS, M.pBin, M.bins - 1, '#22d3ee')

    // aktueller Preis
    ctx.setLineDash([4, 3]); ctx.strokeStyle = '#facc15'; ctx.lineWidth = 1.2
    ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y0 + ch); ctx.stroke(); ctx.setLineDash([])
    ctx.font = 'bold 10.5px "JetBrains Mono", ui-monospace, monospace'; ctx.fillStyle = '#facc15'; ctx.textAlign = 'center'
    ctx.fillText('Preis ' + fmtPrice(M.P, M.P), Math.max(x0 + 50, Math.min(x0 + cw - 50, px)), 12)

    // Preisachse
    ctx.font = '10px "JetBrains Mono", ui-monospace, monospace'; ctx.fillStyle = muted; ctx.textBaseline = 'alphabetic'
    var n = w < 520 ? 3 : 6
    for (var t = 0; t <= n; t++) {
      var p = M.lo + t / n * (M.hi - M.lo)
      ctx.textAlign = t === 0 ? 'left' : t === n ? 'right' : 'center'
      ctx.fillText(fmtPrice(p, M.P), xOfP(p), h - 6)
    }

    // Tooltip
    var hv = state.hoverMap
    if (hv && hv.x >= x0 && hv.x <= x0 + cw && hv.y >= y0 - 10 && hv.y <= y0 + ch) {
      var bi = Math.max(0, Math.min(M.bins - 1, Math.floor((hv.x - x0) / bwid)))
      var bp = M.lo + (bi + 0.5) / M.bins * (M.hi - M.lo)
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(xOfBin(bi), y0, bwid, ch)
      var lines = ['≈ ' + fmtPrice(bp, M.P) + ' (' + (bp >= M.P ? '+' : '') + nf1.format((bp / M.P - 1) * 100) + ' %)']
      var colors = [null]
      EXCHANGES.forEach(function (e) {
        if (!M.per[e.key]) return
        lines.push(e.label + ': ' + fmtUsd(M.per[e.key][bi])); colors.push(e.color)
      })
      if (bi <= M.pBin) { lines.push('Long kumuliert: ' + fmtUsd(M.cumL[bi])); colors.push('#f87171') }
      else { lines.push('Short kumuliert: ' + fmtUsd(M.cumS[bi])); colors.push('#22d3ee') }
      tooltip(ctx, lines, hv.x, Math.max(y0 + 10, hv.y), x0, y0, cw, ch, colors)
    }
  }

  /* ---------- Bewegungs-Kacheln ---------- */
  function renderMoves(ui) {
    var M = heatModel
    var html = ''
    if (!M) { ui.moves.innerHTML = ''; return }
    var P = M.last, act = M.active
    function sum(side, pct) {
      var s = 0, lim = side === 1 ? P * (1 - pct / 100) : P * (1 + pct / 100)
      for (var i = 0; i < act.length; i++) {
        var a = act[i]
        if (a.s !== side) continue
        if (side === 1 && a.p >= lim && a.p <= P) s += a.a
        if (side === -1 && a.p <= lim && a.p >= P) s += a.a
      }
      return s
    }
    var down = MOVES.map(function (m) { return { m: -m, v: sum(1, m) } })
    var up = MOVES.slice().reverse().map(function (m) { return { m: m, v: sum(-1, m) } })
    var max = 0
    down.concat(up).forEach(function (x) { if (x.v > max) max = x.v })
    function tile(x, side) {
      var pct = max ? Math.max(3, x.v / max * 100) : 0
      return '<div class="lrh-tile"><div class="lrh-tile-m ' + side + '">' + (x.m > 0 ? '+' : '−') + Math.abs(x.m) + ' %</div>' +
        '<div class="lrh-tile-v">' + fmtUsd(x.v) + '</div>' +
        '<div class="lrh-bar"><span class="' + side + '" style="width:' + pct.toFixed(1) + '%"></span></div></div>'
    }
    html += '<div class="lrh-moves-head"><span>Long-Liquidationen bei Kursrückgang</span></div>'
    html += '<div class="lrh-tiles">' + down.map(function (x) { return tile(x, 'dn') }).join('') + '</div>'
    html += '<div class="lrh-moves-head"><span>Short-Liquidationen bei Kursanstieg</span></div>'
    html += '<div class="lrh-tiles">' + up.map(function (x) { return tile(x, 'up') }).join('') + '</div>'
    ui.moves.innerHTML = html
  }

  /* ---------- Oberfläche ---------- */
  var CSS =
    '.lrh{min-height:100dvh;background:var(--background);color:var(--text);padding-bottom:calc(84px + env(safe-area-inset-bottom))}' +
    '.lrh-head{position:sticky;top:0;z-index:20;border-bottom:1px solid var(--hairline);background:var(--header-bg);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);padding-top:env(safe-area-inset-top)}' +
    '.lrh-head-in{max-width:1600px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 12px;min-height:52px}' +
    '.lrh-logo{font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:700;font-size:13px;letter-spacing:.16em}' +
    '.lrh-logo b{color:var(--live);font-weight:700}.lrh-logo small{margin-left:8px;font-size:10px;font-weight:500;letter-spacing:.2em;color:var(--text-muted)}' +
    '.lrh-sel{font-family:"JetBrains Mono",ui-monospace,monospace;height:32px;border-radius:4px;border:1px solid var(--hairline);background:var(--panel-2);color:var(--text);padding:0 8px;font-size:12px}' +
    '.lrh-upd{margin-left:auto;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:10px;color:var(--text-muted);letter-spacing:.08em}' +
    '.lrh-main{max-width:1600px;margin:0 auto;padding:12px;display:grid;gap:12px}' +
    '@media(min-width:1100px){.lrh-main{grid-template-columns:3fr 2fr;align-items:start}.lrh-span{grid-column:1/-1}}' +
    '.lrh-card{border:1px solid var(--hairline);background:var(--panel);border-radius:8px;overflow:hidden}' +
    '.lrh-card-h{padding:12px 14px;border-bottom:1px solid var(--hairline)}' +
    '.lrh-title{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--text-muted)}' +
    '.lrh-sub{margin-top:4px;font-size:12.5px;color:var(--text-muted)}' +
    '.lrh-ctrls{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}' +
    '.lrh-seg{display:flex;flex-wrap:wrap;border:1px solid var(--hairline);border-radius:5px;overflow:hidden;background:var(--panel-2)}' +
    '.lrh-seg button{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11.5px;padding:7px 10px;color:var(--text-muted);background:transparent;border:0;cursor:pointer}' +
    '.lrh-seg button.on{color:var(--live);background:rgba(34,211,238,.12)}' +
    '.lrh-cv{padding:8px 6px 4px}.lrh-cv canvas{display:block;touch-action:pan-y;cursor:crosshair}' +
    '.lrh-legend{display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px 14px 0;font-size:12px;color:var(--text-muted)}' +
    '.lrh-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}' +
    '.lrh-legend b{color:var(--text);font-family:"JetBrains Mono",ui-monospace,monospace;font-weight:600}' +
    '.lrh-ratio{padding:6px 14px 0;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;color:#facc15}' +
    '.lrh-scale{display:flex;align-items:center;gap:8px;justify-content:flex-end;padding:4px 14px 0;font-size:11px;color:var(--text-muted)}' +
    '.lrh-scale span.g{width:90px;height:6px;border-radius:3px;background:linear-gradient(90deg,#10204a,#1e508c,#20a096,#78d250,#fde725)}' +
    '.lrh-moves{padding:4px 14px 14px}' +
    '.lrh-moves-head{margin-top:12px;font-size:12px;color:var(--text-muted)}' +
    '.lrh-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:6px;border:1px solid var(--hairline);border-radius:6px;overflow:hidden}' +
    '.lrh-tile{padding:10px 10px 12px;border-right:1px solid var(--hairline)}.lrh-tile:last-child{border-right:0}' +
    '.lrh-tile-m{font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;font-weight:700}.lrh-tile-m.dn{color:#f87171}.lrh-tile-m.up{color:#4ade80}' +
    '.lrh-tile-v{margin-top:4px;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}' +
    '@media(max-width:420px){.lrh-tile{padding:8px 6px 10px}.lrh-tile-v{font-size:12px}}' +
    '.lrh-bar{margin-top:8px;height:4px;border-radius:2px;background:var(--hairline);overflow:hidden}' +
    '.lrh-bar span{display:block;height:100%;border-radius:2px;margin-left:auto}.lrh-bar span.dn{background:#4ade80}.lrh-bar span.up{background:#4ade80}' +
    '.lrh-note{padding:10px 14px 14px;font-size:11.5px;line-height:1.5;color:var(--text-muted)}' +
    '.lrh-err{color:#f87171}'

  function el(tag, cls, html) {
    var e = document.createElement(tag)
    if (cls) e.className = cls
    if (html != null) e.innerHTML = html
    return e
  }
  function seg(items, current, onPick) {
    var s = el('div', 'lrh-seg')
    items.forEach(function (it) {
      var b = el('button', it.key === current ? 'on' : '', it.label)
      b.type = 'button'
      b.addEventListener('click', function () { onPick(it.key) })
      s.appendChild(b)
    })
    return s
  }

  function mount(root) {
    if (!document.getElementById('lrh-style')) {
      var st = el('style'); st.id = 'lrh-style'; st.textContent = CSS; document.head.appendChild(st)
    }
    root.innerHTML = ''
    var wrap = el('div', 'lrh')
    root.appendChild(wrap)

    var head = el('header', 'lrh-head')
    var hin = el('div', 'lrh-head-in')
    hin.appendChild(el('span', 'lrh-logo', 'LIQ<b>RADAR</b><small>HEATMAP</small>'))
    var sel = el('select', 'lrh-sel')
    sel.setAttribute('aria-label', 'Coin auswählen')
    COINS.forEach(function (c) { var o = el('option', null, c); o.value = c; sel.appendChild(o) })
    sel.value = state.coin
    sel.addEventListener('change', function () { state.coin = sel.value; save(); load(true); loadMap(true) })
    hin.appendChild(sel)
    var upd = el('span', 'lrh-upd', '')
    hin.appendChild(upd)
    head.appendChild(hin)
    wrap.appendChild(head)

    var main = el('main', 'lrh-main')
    wrap.appendChild(main)

    // Karte 1: Heatmap
    var c1 = el('section', 'lrh-card lrh-span')
    var h1 = el('div', 'lrh-card-h')
    h1.appendChild(el('div', 'lrh-title', 'Liquidations-Heatmap · Zeit × Preis'))
    var sub1 = el('div', 'lrh-sub', '')
    h1.appendChild(sub1)
    var ctr1 = el('div', 'lrh-ctrls')
    h1.appendChild(ctr1)
    c1.appendChild(h1)
    var scale = el('div', 'lrh-scale', 'Weniger <span class="g"></span> Mehr')
    c1.appendChild(scale)
    var hw = el('div', 'lrh-cv'), hc = el('canvas')
    hw.appendChild(hc); c1.appendChild(hw)
    var movesHead = el('div', 'lrh-moves')
    c1.appendChild(movesHead)
    main.appendChild(c1)

    // Karte 2: Börsen-Liquidationskarte
    var c2 = el('section', 'lrh-card lrh-span')
    var h2 = el('div', 'lrh-card-h')
    h2.appendChild(el('div', 'lrh-title', 'Börsen-Liquidationskarte'))
    var sub2 = el('div', 'lrh-sub', '')
    h2.appendChild(sub2)
    var ctr2 = el('div', 'lrh-ctrls')
    h2.appendChild(ctr2)
    c2.appendChild(h2)
    var legend = el('div', 'lrh-legend')
    c2.appendChild(legend)
    var ratio = el('div', 'lrh-ratio')
    c2.appendChild(ratio)
    var mw = el('div', 'lrh-cv'), mc = el('canvas')
    mw.appendChild(mc); c2.appendChild(mw)
    c2.appendChild(el('div', 'lrh-note',
      'Schätzmodell aus öffentlichen Kerzen und Handelsvolumen von Binance, Bybit und Hyperliquid mit typischer Hebel-Verteilung (10x–100x). ' +
      'Börsen veröffentlichen keine Einzelpositionen — die Werte sind Richtwerte wie bei Coinglass oder coinperps, keine echten Orderbuchdaten und keine Anlageberatung. ' +
      'Antippen bzw. Ziehen über die Karten zeigt Details.'))
    main.appendChild(c2)

    var ui = { root: root, upd: upd, sub1: sub1, ctr1: ctr1, ctr2: ctr2, heatWrap: hw, heatCanvas: hc, moves: movesHead, sub2: sub2, legend: legend, ratio: ratio, mapWrap: mw, mapCanvas: mc }
    current = ui

    function pointer(cv, key) {
      function set(e) {
        var r = cv.getBoundingClientRect()
        state[key] = { x: e.clientX - r.left, y: e.clientY - r.top }
        redraw()
      }
      cv.addEventListener('pointermove', set)
      cv.addEventListener('pointerdown', set)
      cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { state[key] = null; redraw() } })
    }
    pointer(hc, 'hoverHeat')
    pointer(mc, 'hoverMap')

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () { redraw() })
      ro.observe(hw)
      ui.ro = ro
    } else window.addEventListener('resize', redraw)

    renderControls()
    redraw()
    load(false)
    loadMap(false)
    clearInterval(timer)
    timer = setInterval(function () {
      if (!current || !current.root.isConnected) { unmount(); return }
      if (document.visibilityState === 'visible') { load(false); loadMap(false) }
    }, REFRESH_MS)
  }

  var current = null, timer = null, loadSeq = 0
  function unmount() {
    clearInterval(timer); timer = null
    if (current && current.ro) current.ro.disconnect()
    current = null
  }

  function renderControls() {
    var ui = current
    if (!ui) return
    ui.ctr1.innerHTML = ''
    ui.ctr1.appendChild(seg(EXCHANGES.map(function (e) { return { key: e.key, label: e.label } }).concat([{ key: 'all', label: 'Alle' }]), state.ex, function (k) {
      state.ex = k; save(); renderControls(); computeHeat(); redraw()
    }))
    ui.ctr1.appendChild(seg(TFS.map(function (t) { return { key: t.key, label: t.label } }), state.tf, function (k) {
      state.tf = k; save(); renderControls(); load(true)
    }))
    ui.ctr2.innerHTML = ''
    ui.ctr2.appendChild(seg(MAP_TFS, state.mapTf, function (k) {
      state.mapTf = k; save(); renderControls(); loadMap(true)
    }))
  }

  function redraw() {
    var ui = current
    if (!ui) return
    var tf = tfObj()
    var exLabel = state.ex === 'all' ? 'alle Börsen' : EXCHANGES.filter(function (e) { return e.key === state.ex })[0].label
    ui.sub1.textContent = 'Geschätzte Liquidationsniveaus · ' + state.coin + ' · ' + exLabel + ' · ' + tf.long + ', ' + IV_LABEL[tf.iv]
    var errs = [], mtf = mapTfObj()
    EXCHANGES.forEach(function (e) { var d = state.mapData[e.key]; if (d && d.err) errs.push(e.label) })
    ui.sub2.innerHTML = 'Offene Liquidationsniveaus im Bereich ±' + Math.round(mtf.range * 100) + ' % · ' + state.coin + ' · Positionen der letzten ' + mtf.long +
      (errs.length ? ' · <span class="lrh-err">nicht verfügbar: ' + errs.join(', ') + '</span>' : '')
    ui.upd.textContent = state.loading ? 'LÄDT …' : state.updated ? 'STAND ' + pad2(state.updated.getHours()) + ':' + pad2(state.updated.getMinutes()) + ':' + pad2(state.updated.getSeconds()) : ''
    drawHeat(ui)
    renderMoves(ui)
    // Legende Karte 2
    var M = mapModel
    if (M) {
      var lg = '<span><i style="background:#f87171"></i>Long-Pool <b>' + fmtUsd(M.longTotal) + '</b></span>' +
        '<span><i style="background:#22d3ee"></i>Short-Pool <b>' + fmtUsd(M.shortTotal) + '</b></span>'
      EXCHANGES.forEach(function (e) {
        if (!M.per[e.key]) return
        var s = 0; for (var i = 0; i < M.bins; i++) s += M.per[e.key][i]
        lg += '<span><i style="background:' + e.color + '"></i>' + e.label + ' <b>' + fmtUsd(s) + '</b></span>'
      })
      ui.legend.innerHTML = lg
      var r = M.longTotal && M.shortTotal ? (M.shortTotal >= M.longTotal ? M.shortTotal / M.longTotal : M.longTotal / M.shortTotal) : 0
      ui.ratio.textContent = r ? '≈ ' + nf1.format(r) + '× mehr ' + (M.shortTotal >= M.longTotal ? 'Short' : 'Long') + '-Liquidationen im Bereich ±' + Math.round(M.tf.range * 100) + ' %' : ''
    } else { ui.legend.innerHTML = ''; ui.ratio.textContent = '' }
    drawMap(ui)
  }

  function load(clearFirst) {
    var tf = tfObj(), coin = state.coin, seq = ++loadSeq
    var cols = Math.round(tf.ms / IV_MS[tf.iv])
    var count = Math.min(1000, cols * 2)
    if (clearFirst) { state.data = {}; heatModel = null }
    state.loading = true
    redraw()
    var jobs = EXCHANGES.map(function (e) {
      return fetchCandles(e.key, coin, tf.iv, count).then(function (c) {
        return { key: e.key, candles: c, levels: buildLevels(c, tf) }
      }, function (err) {
        return { key: e.key, err: String(err && err.message || err) }
      })
    })
    Promise.all(jobs).then(function (res) {
      if (seq !== loadSeq) return
      var data = {}
      res.forEach(function (r) { data[r.key] = r })
      state.data = data
      state.loading = false
      state.updated = new Date()
      computeHeat(); redraw()
    })
  }

  var mapSeq = 0
  function loadMap(clearFirst) {
    var tf = mapTfObj(), coin = state.coin, seq = ++mapSeq
    var cols = Math.round(tf.ms / IV_MS[tf.iv])
    var count = Math.min(1000, cols * 2)
    if (clearFirst) { state.mapData = {}; mapModel = null }
    state.mapLoading = true
    redraw()
    Promise.all(EXCHANGES.map(function (e) {
      return fetchCandles(e.key, coin, tf.iv, count).then(function (c) {
        return { key: e.key, candles: c, levels: buildLevels(c, tf) }
      }, function (err) { return { key: e.key, err: String(err && err.message || err) } })
    })).then(function (res) {
      if (seq !== mapSeq) return
      var data = {}
      res.forEach(function (r) { data[r.key] = r })
      state.mapData = data
      state.mapLoading = false
      computeMap(); redraw()
    })
  }

  // Einhängen, sobald die App den Reiter rendert
  function scan() {
    var root = document.getElementById('lr-heatmap-root')
    if (root && !root.getAttribute('data-lrh')) {
      root.setAttribute('data-lrh', '1')
      mount(root)
    } else if (!root && current) {
      unmount()
    }
  }
  function start() {
    scan()
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true })
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()

  function ensureStyle() {
    if (!document.getElementById('lrh-style')) {
      var st = el('style'); st.id = 'lrh-style'; st.textContent = CSS; document.head.appendChild(st)
    }
  }
  // auch vom Reiter „Heute" genutzt
  window.__lrHeatmap = {
    state: state, buildLevels: buildLevels, activeLevels: activeLevels, fetchCandles: fetchCandles,
    TFS: TFS, EXCHANGES: EXCHANGES, IV_MS: IV_MS, COINS: COINS, ensureStyle: ensureStyle,
    fmtUsd: fmtUsd, fmtPrice: fmtPrice, fetchJson: fetchJson,
  }
})()
