/* LIQRADAR v25 — Reiter „Kurse": Top-100-Kryptowährungen nach Marktkapitalisierung
   Daten: CoinGecko (öffentliche API, ohne Schlüssel), Ersatz: CoinPaprika; Angst-&-Gier-Index: alternative.me
   Alles direkt im Browser, kein Server, keine KI. */
(function () {
  'use strict'
  var st = {
    cur: 'usd', per: '24h', q: '', sort: 'rank', dir: 1, open: null,
    rows: null, global: null, fng: null, src: null, at: null, loading: false, err: null,
  }
  try {
    var sv = JSON.parse(localStorage.getItem('liqradar-kurse') || '{}')
    if (sv.cur === 'eur') st.cur = 'eur'
    if (['1h', '24h', '7d', '30d'].indexOf(sv.per) >= 0) st.per = sv.per
    var cached = JSON.parse(localStorage.getItem('liqradar-kurse-cache') || 'null')
    if (cached && cached.cur === st.cur) { st.rows = cached.rows; st.global = cached.global; st.src = cached.src; st.at = new Date(cached.at) }
  } catch (e) {}
  function save() { try { localStorage.setItem('liqradar-kurse', JSON.stringify({ cur: st.cur, per: st.per })) } catch (e) {} }
  function saveCache() {
    try { localStorage.setItem('liqradar-kurse-cache', JSON.stringify({ cur: st.cur, rows: st.rows, global: st.global, src: st.src, at: st.at && st.at.getTime() })) } catch (e) {}
  }
  var PER_LABEL = { '1h': '1 Std. %', '24h': '24 Std. %', '7d': '7 Tage %', '30d': '30 Tage %' }
  var HEAT_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'ADA', 'LINK', 'AVAX', 'SUI']

  /* ---------- Formatierung ---------- */
  function nf(min, max) { return new Intl.NumberFormat('de-DE', { minimumFractionDigits: min, maximumFractionDigits: max }) }
  var F2 = nf(2, 2)
  function money(v, cur, digits) {
    var s = (digits != null ? nf(digits, digits) : F2).format(v)
    return cur === 'eur' ? s + ' €' : '$' + s
  }
  function price(v, cur) {
    if (v == null || !isFinite(v)) return '–'
    var a = Math.abs(v)
    var d = a >= 1 ? 2 : a >= 0.01 ? 4 : a >= 0.0001 ? 6 : 8
    return money(v, cur, d)
  }
  function big(v, cur) {
    if (v == null || !isFinite(v)) return '–'
    var a = Math.abs(v), s
    if (a >= 1e12) s = F2.format(v / 1e12) + ' Bio'
    else if (a >= 1e9) s = F2.format(v / 1e9) + ' Mrd'
    else if (a >= 1e6) s = F2.format(v / 1e6) + ' Mio'
    else s = nf(0, 0).format(v)
    return cur === 'eur' ? s + ' €' : '$' + s
  }
  function chg(v) {
    if (v == null || !isFinite(v)) return '<span class="lrk-chg">–</span>'
    var up = v >= 0
    return '<span class="lrk-chg ' + (up ? 'up' : 'dn') + '"><i>' + (up ? '▲' : '▼') + '</i>' + F2.format(Math.abs(v)) + '%</span>'
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }) }
  function pad2(n) { return (n < 10 ? '0' : '') + n }

  /* ---------- Daten ---------- */
  function getJson(url) {
    var ctrl = 'AbortController' in window ? new AbortController() : null
    var t = ctrl ? setTimeout(function () { ctrl.abort() }, 15000) : null
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (r) {
      if (t) clearTimeout(t)
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return r.json()
    })
  }
  function fromGecko(cur) {
    var base = 'https://api.coingecko.com/api/v3/'
    return Promise.all([
      getJson(base + 'coins/markets?vs_currency=' + cur + '&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=1h,24h,7d,30d'),
      getJson(base + 'global').catch(function () { return null }),
    ]).then(function (r) {
      var list = r[0]
      if (!Array.isArray(list) || !list.length) throw new Error('leer')
      var rows = list.map(function (c) {
        return {
          id: c.id, rank: c.market_cap_rank, sym: (c.symbol || '').toUpperCase(), name: c.name, img: c.image,
          price: c.current_price, mcap: c.market_cap, vol: c.total_volume, hi: c.high_24h, lo: c.low_24h,
          ath: c.ath, athPct: c.ath_change_percentage, athDate: c.ath_date, supply: c.circulating_supply,
          ch: { '1h': c.price_change_percentage_1h_in_currency, '24h': c.price_change_percentage_24h_in_currency, '7d': c.price_change_percentage_7d_in_currency, '30d': c.price_change_percentage_30d_in_currency },
          spark: c.sparkline_in_7d && c.sparkline_in_7d.price ? c.sparkline_in_7d.price.filter(function (_, i) { return i % 2 === 0 }) : null,
        }
      })
      var g = r[1] && r[1].data
      var global = g ? { mcap: g.total_market_cap[cur], ch: g.market_cap_change_percentage_24h_usd, btcDom: g.market_cap_percentage && g.market_cap_percentage.btc, ethDom: g.market_cap_percentage && g.market_cap_percentage.eth, vol: g.total_volume && g.total_volume[cur] } : null
      return { rows: rows, global: global, src: 'CoinGecko' }
    })
  }
  function fromPaprika(cur) {
    var q = cur.toUpperCase()
    return Promise.all([
      getJson('https://api.coinpaprika.com/v1/tickers?quotes=' + q + '&limit=100'),
      getJson('https://api.coinpaprika.com/v1/global').catch(function () { return null }),
    ]).then(function (r) {
      var list = r[0]
      if (!Array.isArray(list) || !list.length) throw new Error('leer')
      list.sort(function (a, b) { return a.rank - b.rank })
      var rows = list.slice(0, 100).map(function (c) {
        var x = c.quotes[q] || {}
        return {
          id: c.id, rank: c.rank, sym: c.symbol, name: c.name, img: 'https://static.coinpaprika.com/coin/' + c.id + '/logo.png',
          price: x.price, mcap: x.market_cap, vol: x.volume_24h, ath: x.ath_price, athPct: x.percent_from_price_ath, athDate: x.ath_date, supply: c.circulating_supply,
          ch: { '1h': x.percent_change_1h, '24h': x.percent_change_24h, '7d': x.percent_change_7d, '30d': x.percent_change_30d }, spark: null,
        }
      })
      var g = r[1]
      var global = g ? { mcap: cur === 'usd' ? g.market_cap_usd : null, ch: g.market_cap_change_24h, btcDom: g.bitcoin_dominance_percentage, vol: cur === 'usd' ? g.volume_24h_usd : null } : null
      return { rows: rows, global: global, src: 'CoinPaprika' }
    })
  }
  function load() {
    var cur = st.cur
    st.loading = true; render()
    fromGecko(cur).catch(function () { return fromPaprika(cur) }).then(function (res) {
      if (cur !== st.cur) return
      st.rows = res.rows; st.global = res.global; st.src = res.src; st.at = new Date(); st.err = null
      saveCache()
    }, function (e) {
      st.err = 'Kurse gerade nicht erreichbar' + (st.rows ? ' — zeige letzten Stand.' : '.')
    }).then(function () { st.loading = false; render() })
    if (!st.fng || Date.now() - st.fng.at > 30 * 60e3) {
      getJson('https://api.alternative.me/fng/?limit=2').then(function (j) {
        var d = j && j.data
        if (d && d.length) { st.fng = { v: +d[0].value, cls: d[0].value_classification, prev: d[1] ? +d[1].value : null, at: Date.now() }; render() }
      }).catch(function () {})
    }
  }

  /* ---------- Darstellung ---------- */
  var FNG_DE = { 'Extreme Fear': 'Extreme Angst', Fear: 'Angst', Neutral: 'Neutral', Greed: 'Gier', 'Extreme Greed': 'Extreme Gier' }
  function fngColor(v) { return v < 25 ? '#f87171' : v < 45 ? '#fb923c' : v < 55 ? '#facc15' : v < 75 ? '#a3e635' : '#4ade80' }

  var CSS =
    '.lrk{min-height:100dvh;background:var(--background);color:var(--text);padding-bottom:calc(84px + env(safe-area-inset-bottom))}' +
    '.lrk-in{max-width:900px;margin:0 auto;padding:12px}' +
    '.lrk-tiles{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--hairline);border-radius:14px;background:var(--panel);overflow:hidden}' +
    '.lrk-tile{padding:12px 12px 13px;border-right:1px solid var(--hairline)}.lrk-tile:last-child{border-right:0}' +
    '.lrk-tile small{display:block;font-size:12px;color:var(--text-muted)}' +
    '.lrk-tile b{display:block;margin-top:4px;font-size:17px;font-weight:700;white-space:nowrap}' +
    '.lrk-tile span{display:block;margin-top:3px;font-size:12.5px;color:var(--text-muted)}' +
    '@media(max-width:400px){.lrk-tile{padding:10px 9px}.lrk-tile b{font-size:15px}}' +
    '.lrk-search{position:relative;margin-top:12px}' +
    '.lrk-search input{width:100%;box-sizing:border-box;height:46px;border-radius:23px;border:1px solid var(--hairline);background:var(--panel);color:var(--text);font-size:16px;padding:0 16px 0 44px;outline:none}' +
    '.lrk-search input:focus{border-color:var(--live)}' +
    '.lrk-search svg{position:absolute;left:15px;top:13px;width:20px;height:20px;color:var(--text-muted)}' +
    '.lrk-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px}' +
    '.lrk-sel{height:38px;border-radius:19px;border:1px solid var(--hairline);background:var(--panel);color:var(--text);font-size:14px;padding:0 12px;font-weight:600}' +
    '.lrk-cur{display:flex;border:1px solid var(--hairline);border-radius:19px;background:var(--panel);padding:3px}' +
    '.lrk-cur button{border:0;background:transparent;color:var(--text-muted);font-size:14px;font-weight:600;padding:6px 14px;border-radius:16px;cursor:pointer}' +
    '.lrk-cur button.on{background:var(--panel-2);color:var(--text)}' +
    '.lrk-head,.lrk-row{display:grid;grid-template-columns:30px 1fr auto 84px;align-items:center;gap:8px}' +
    '.lrk-head{margin-top:14px;padding:0 4px 8px;font-size:12.5px;font-weight:700;color:var(--text)}' +
    '.lrk-head button{all:unset;cursor:pointer}.lrk-head .r{text-align:right}' +
    '.lrk-row{padding:11px 4px;border-top:1px solid var(--hairline);cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    '.lrk-row:hover{background:rgba(148,163,184,.06)}' +
    '.lrk-rk{font-size:13px;color:var(--text-muted)}' +
    '.lrk-coin{display:flex;align-items:center;gap:10px;min-width:0}' +
    '.lrk-coin img{width:30px;height:30px;border-radius:50%;flex:0 0 30px;background:var(--panel-2)}' +
    '.lrk-coin div{min-width:0}.lrk-coin b{display:block;font-size:15px}.lrk-coin small{display:block;font-size:12px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.lrk-px{text-align:right;font-size:14.5px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.lrk-chg{display:block;text-align:right;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.lrk-chg i{font-style:normal;font-size:10px;margin-right:4px;vertical-align:1px}' +
    '.lrk-chg.up{color:#4ade80}.lrk-chg.dn{color:#f87171}' +
    '.lrk-tile .lrk-chg{text-align:left;font-size:13px;margin-top:3px}.lrk-kv .lrk-chg{text-align:left}' +
    '.lrk-det{padding:4px 4px 14px;border-top:1px dashed var(--hairline)}' +
    '.lrk-det svg{display:block;width:100%;height:auto;margin:6px 0}' +
    '.lrk-kv{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}' +
    '@media(min-width:640px){.lrk-kv{grid-template-columns:repeat(4,1fr)}}' +
    '.lrk-kv div{padding:8px 10px;border:1px solid var(--hairline);border-radius:8px;font-size:11.5px;color:var(--text-muted)}' +
    '.lrk-kv b{display:block;margin-top:2px;font-size:13px;color:var(--text);font-variant-numeric:tabular-nums}' +
    '.lrk-btns{display:flex;gap:8px;margin-top:8px}.lrk-btns a{flex:1;text-align:center;padding:9px;border-radius:8px;border:1px solid var(--hairline);color:var(--live);font-size:13px;font-weight:600;text-decoration:none}' +
    '.lrk-note{margin-top:14px;font-size:11.5px;color:var(--text-muted);line-height:1.5}' +
    '.lrk-err{margin-top:10px;font-size:12.5px;color:#fb923c}' +
    '.lrk-empty{padding:30px 0;text-align:center;color:var(--text-muted)}'

  function spark(arr, up) {
    if (!arr || arr.length < 2) return ''
    var W = 600, Hh = 110, min = Infinity, max = -Infinity
    arr.forEach(function (v) { if (v < min) min = v; if (v > max) max = v })
    var rg = max - min || 1
    var pts = arr.map(function (v, i) { return (i / (arr.length - 1) * W).toFixed(1) + ',' + (6 + (1 - (v - min) / rg) * (Hh - 12)).toFixed(1) }).join(' ')
    var col = up ? '#4ade80' : '#f87171'
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" preserveAspectRatio="none" aria-label="7-Tage-Verlauf"><polyline points="0,' + Hh + ' ' + pts + ' ' + W + ',' + Hh + '" fill="' + col + '" fill-opacity=".08" stroke="none"/><polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'
  }

  function detail(r) {
    var cur = st.cur
    var h = '<div class="lrk-det">'
    if (r.spark) h += '<div style="font-size:11.5px;color:var(--text-muted);margin-top:6px">Verlauf 7 Tage</div>' + spark(r.spark, (r.ch['7d'] || 0) >= 0)
    h += '<div class="lrk-kv">'
    h += '<div>1 Std.' + '<b>' + chg(r.ch['1h']) + '</b></div><div>7 Tage<b>' + chg(r.ch['7d']) + '</b></div><div>30 Tage<b>' + chg(r.ch['30d']) + '</b></div>'
    h += '<div>Volumen 24 Std.<b>' + big(r.vol, cur) + '</b></div>'
    if (r.hi != null) h += '<div>Hoch 24 Std.<b>' + price(r.hi, cur) + '</b></div><div>Tief 24 Std.<b>' + price(r.lo, cur) + '</b></div>'
    if (r.ath != null) h += '<div>Allzeithoch' + (r.athDate ? ' (' + new Date(r.athDate).toLocaleDateString('de-DE', { month: '2-digit', year: 'numeric' }) + ')' : '') + '<b>' + price(r.ath, cur) + '</b></div>' +
      '<div>Abstand zum Hoch<b>' + chg(r.athPct) + '</b></div>'
    h += '</div>'
    if (HEAT_COINS.indexOf(r.sym) >= 0) {
      h += '<div class="lrk-btns"><a href="#heatmap" data-heat="' + r.sym + '">Liquidations-Heatmap ' + esc(r.sym) + '</a><a href="#heute" data-day="' + r.sym + '">Tagesplan ' + esc(r.sym) + '</a></div>'
    }
    return h + '</div>'
  }

  function listHtml() {
    var cur = st.cur, html = ''
    var arrow = function (k) { return st.sort === k ? (st.dir > 0 ? ' ▲' : ' ▼') : '' }
    html += '<div class="lrk-head"><button type="button" data-s="rank">#' + arrow('rank') + '</button><button type="button" data-s="mcap">Marktkapitalisierung' + arrow('mcap') + '</button>' +
      '<button type="button" class="r" data-s="price">Preis' + arrow('price') + '</button><button type="button" class="r" data-s="chg">' + PER_LABEL[st.per] + arrow('chg') + '</button></div>'
    var rows = (st.rows || []).slice()
    var q = st.q.trim().toLowerCase()
    if (q) rows = rows.filter(function (r) { return r.sym.toLowerCase().indexOf(q) >= 0 || r.name.toLowerCase().indexOf(q) >= 0 })
    var key = function (r) { return st.sort === 'rank' ? r.rank : st.sort === 'mcap' ? -r.mcap : st.sort === 'price' ? -r.price : -(r.ch[st.per] == null ? -1e9 : r.ch[st.per]) }
    rows.sort(function (a, b) { return (key(a) - key(b)) * st.dir })
    if (!st.rows) html += '<div class="lrk-empty">Lade Kurse …</div>'
    else if (!rows.length) html += '<div class="lrk-empty">Kein Treffer für „' + esc(st.q) + '“.</div>'
    rows.forEach(function (r) {
      html += '<div class="lrk-row" data-id="' + esc(r.id) + '"><span class="lrk-rk">' + (r.rank || '–') + '</span>' +
        '<span class="lrk-coin"><img src="' + esc(r.img) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility=\'hidden\'"><div><b>' + esc(r.sym) + '</b><small>' + big(r.mcap, cur) + '</small></div></span>' +
        '<span class="lrk-px">' + price(r.price, cur) + '</span>' + chg(r.ch[st.per]) + '</div>'
      if (st.open === r.id) html += detail(r)
    })
    return html
  }
  function renderList() {
    var box = root && root.querySelector('#lrk-list')
    if (!box) return
    box.innerHTML = listHtml()
    bindList()
  }

  var root = null, timer = null
  function render() {
    if (root && (!root.isConnected || root.id !== 'lr-kurse-root')) root = null
    if (!root) return
    var cur = st.cur, g = st.global
    var html = '<div class="lrk">'
    html += '<header class="lrh-head"><div class="lrh-head-in"><span class="lrh-logo">LIQ<b>RADAR</b><small>KURSE</small></span>' +
      '<span class="lrh-upd">' + (st.loading && !st.rows ? 'LÄDT …' : st.at ? 'STAND ' + pad2(st.at.getHours()) + ':' + pad2(st.at.getMinutes()) : '') + '</span></div></header>'
    html += '<div class="lrk-in">'
    // Kacheln
    html += '<div class="lrk-tiles">'
    html += '<div class="lrk-tile"><small>Market Cap</small><b>' + (g && g.mcap ? big(g.mcap, cur) : '–') + '</b>' + (g && g.ch != null ? chg(g.ch) : '<span>&nbsp;</span>') + '</div>'
    html += '<div class="lrk-tile"><small>BTC-Dominanz</small><b>' + (g && g.btcDom ? F2.format(g.btcDom) + ' %' : '–') + '</b><span>' + (g && g.ethDom ? 'ETH ' + nf(1, 1).format(g.ethDom) + ' %' : 'Anteil am Markt') + '</span></div>'
    var f = st.fng
    html += '<div class="lrk-tile"><small>Angst &amp; Gier</small><b style="color:' + (f ? fngColor(f.v) : 'inherit') + '">' + (f ? f.v + ' / 100' : '–') + '</b><span>' + (f ? (FNG_DE[f.cls] || f.cls) + (f.prev != null ? ' · gestern ' + f.prev : '') : '&nbsp;') + '</span></div>'
    html += '</div>'
    // Suche + Leiste
    html += '<div class="lrk-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>' +
      '<input id="lrk-q" type="search" inputmode="search" autocomplete="off" placeholder="Krypto-Name oder Abkürzung suchen" value="' + esc(st.q) + '"></div>'
    html += '<div class="lrk-bar"><select class="lrk-sel" id="lrk-per" aria-label="Zeitraum der Veränderung">' +
      Object.keys(PER_LABEL).map(function (k) { return '<option value="' + k + '"' + (k === st.per ? ' selected' : '') + '>' + PER_LABEL[k] + '</option>' }).join('') + '</select>' +
      '<div class="lrk-cur"><button type="button" data-c="usd" class="' + (cur === 'usd' ? 'on' : '') + '">USD</button><button type="button" data-c="eur" class="' + (cur === 'eur' ? 'on' : '') + '">EUR</button></div></div>'
    if (st.err) html += '<div class="lrk-err">' + esc(st.err) + '</div>'
    html += '<div id="lrk-list">' + listHtml() + '</div>'
    html += '<div class="lrk-note">Top 100 nach Marktkapitalisierung · Daten: ' + (st.src || 'CoinGecko') + ', Angst-&amp;-Gier-Index: alternative.me · aktualisiert jede Minute. Zeile antippen für Details.</div>'
    html += '</div></div>'

    root.innerHTML = html
    bind()
  }

  function bind() {
    var inp = root.querySelector('#lrk-q')
    inp.addEventListener('input', function () { st.q = inp.value; renderList() })
    root.querySelector('#lrk-per').addEventListener('change', function (e) { st.per = e.target.value; if (st.sort === 'chg') st.dir = 1; save(); render() })
    Array.prototype.forEach.call(root.querySelectorAll('.lrk-cur button'), function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-c'); if (c === st.cur) return
        st.cur = c; st.rows = null; st.global = null; save()
        try { var cc = JSON.parse(localStorage.getItem('liqradar-kurse-cache') || 'null'); if (cc && cc.cur === c) { st.rows = cc.rows; st.global = cc.global } } catch (e) {}
        load()
      })
    })
    bindList()
  }
  function bindList() {
    Array.prototype.forEach.call(root.querySelectorAll('.lrk-head button'), function (b) {
      b.addEventListener('click', function () {
        var s = b.getAttribute('data-s')
        if (st.sort === s) st.dir = -st.dir; else { st.sort = s; st.dir = 1 }
        render()
      })
    })
    Array.prototype.forEach.call(root.querySelectorAll('.lrk-row'), function (r) {
      r.addEventListener('click', function () { var id = r.getAttribute('data-id'); st.open = st.open === id ? null : id; render() })
    })
    Array.prototype.forEach.call(root.querySelectorAll('[data-heat]'), function (a) {
      a.addEventListener('click', function () {
        try { var o = JSON.parse(localStorage.getItem('liqradar-heatmap') || '{}'); o.coin = a.getAttribute('data-heat'); localStorage.setItem('liqradar-heatmap', JSON.stringify(o)) } catch (e) {}
        if (window.__lrHeatmap) window.__lrHeatmap.state.coin = a.getAttribute('data-heat')
      })
    })
    Array.prototype.forEach.call(root.querySelectorAll('[data-day]'), function (a) {
      a.addEventListener('click', function () {
        try { localStorage.setItem('liqradar-daily', JSON.stringify({ coin: a.getAttribute('data-day') })) } catch (e) {}
        if (window.__lrDaily) window.__lrDaily.st.coin = a.getAttribute('data-day')
      })
    })
  }

  function mount(el) {
    try { var kc = JSON.parse(localStorage.getItem('liqradar-kurse') || '{}'); if ((kc.cur === 'eur' || kc.cur === 'usd') && kc.cur !== st.cur) { st.cur = kc.cur; st.rows = null; st.global = null } } catch (e) {}
    if (window.__lrHeatmap) window.__lrHeatmap.ensureStyle()
    if (!document.getElementById('lrk-style')) {
      var s = document.createElement('style'); s.id = 'lrk-style'; s.textContent = CSS; document.head.appendChild(s)
    }
    root = el
    render(); load()
    clearInterval(timer)
    timer = setInterval(function () {
      if (!root || !root.isConnected) { clearInterval(timer); root = null; return }
      if (document.visibilityState === 'visible' && !(document.activeElement && document.activeElement.id === 'lrk-q') && (!window.__lrShouldRefresh || window.__lrShouldRefresh('kurse', 60e3))) load()
    }, 60e3)
  }
  function scan() {
    var el = document.getElementById('lr-kurse-root')
    if (el && !el.getAttribute('data-lrk')) { el.setAttribute('data-lrk', '1'); mount(el) }
  }
  function start() { scan(); new MutationObserver(scan).observe(document.body, { childList: true, subtree: true }) }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
