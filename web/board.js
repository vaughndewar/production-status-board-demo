// Production status board demo. Replays one synthetic 8-hour shift from board.json.
// All data is made up (see lab-source/production-status-board in the repo).
(function () {
  'use strict';
  var STATUS_TEXT = {
    queued: '● Queued',
    in_production: '▶ In production',
    quality_hold: '⏸ Quality hold',
    complete: '✓ Complete',
    idle: '○ Idle'
  };
  var data = null, t = 0, speed = 4, playing = false, last = 0, timer = null;

  var el = {
    clock: document.getElementById('clock'),
    kpis: document.getElementById('kpis'),
    lines: document.getElementById('lines'),
    play: document.getElementById('play'),
    speed: document.getElementById('speed'),
    restart: document.getElementById('restart'),
    kiosk: document.getElementById('kiosk')
  };

  var params = new URLSearchParams(location.search);
  if (params.get('kiosk') === '1') document.body.classList.add('kiosk');
  if (el.kiosk) el.kiosk.href = params.get('kiosk') === '1' ? '?' : '?kiosk=1';
  if (el.kiosk) el.kiosk.textContent = params.get('kiosk') === '1' ? 'Exit kiosk view' : 'Kiosk view';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function statusAt(o, now) {
    var s = 'queued';
    for (var i = 0; i < o.events.length; i++) {
      if (o.events[i][0] <= now) s = o.events[i][1]; else break;
    }
    return s;
  }

  function doneQty(o, now) {
    // Fraction of productive minutes elapsed (time on hold does not count).
    var total = 0, got = 0, ev = o.events;
    for (var i = 0; i < ev.length - 1; i++) {
      if (ev[i][1] === 'in_production') {
        var a = ev[i][0], b = ev[i + 1][0];
        total += b - a;
        got += Math.max(0, Math.min(now, b) - a);
      }
    }
    return total ? Math.round(o.qty * Math.min(1, got / total)) : 0;
  }

  function completedAt(o) { return o.events[o.events.length - 1][0]; }

  function clockText(now) {
    var m = 6 * 60 + Math.floor(now);
    var h = Math.floor(m / 60) % 24, mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  function render() {
    var now = t, counts = { in_production: 0, quality_hold: 0, complete: 0 }, onTime = 0, closed = 0;
    var html = '';
    data.lines.forEach(function (name) {
      var orders = data.orders.filter(function (o) { return o.line === name; });
      var cur = null, queued = [], done = 0;
      orders.forEach(function (o) {
        var s = statusAt(o, now);
        o._s = s;
        if (s === 'complete') {
          done++; counts.complete++; closed++;
          if (completedAt(o) <= o.plannedEnd) onTime++;
        } else if (s === 'in_production' || s === 'quality_hold') {
          cur = o; counts[s]++;
        } else { queued.push(o); }
      });
      var status = cur ? cur._s : (queued.length ? 'queued' : 'complete');
      var body;
      if (cur) {
        var q = doneQty(cur, now);
        body = '<p class="wo"><strong>' + esc(cur.wo) + '</strong> &middot; ' + esc(cur.product) + ' (' + esc(cur.sku) + ')</p>' +
          '<p class="meta">' + q + ' of ' + cur.qty + ' units' +
          (cur._s === 'quality_hold' && cur.holdReason ? ' &middot; Held: ' + esc(cur.holdReason) : '') + '</p>' +
          '<progress max="' + cur.qty + '" value="' + q + '" aria-label="' + esc(cur.wo) + ' progress">' + q + '</progress>';
      } else if (queued.length) {
        body = '<p class="wo">Between orders. Next up: <strong>' + esc(queued[0].wo) + '</strong> &middot; ' + esc(queued[0].product) + '</p>';
      } else {
        body = '<p class="wo">All orders for this shift are complete.</p>';
      }
      var upcoming = queued.slice(cur ? 0 : 1, (cur ? 0 : 1) + 2).map(function (o) {
        return '<li>Next: ' + esc(o.wo) + ' &middot; ' + esc(o.product) + '</li>';
      }).join('');
      html += '<article class="line" data-status="' + status + '"><h3>' + esc(name) +
        ' <span class="badge">' + STATUS_TEXT[status] + '</span></h3>' + body +
        '<p class="meta">' + done + ' of ' + orders.length + ' orders complete</p>' +
        (upcoming ? '<ul class="next">' + upcoming + '</ul>' : '') + '</article>';
    });
    el.lines.innerHTML = html;
    el.kpis.innerHTML =
      kpi(counts.in_production, 'In production') +
      kpi(counts.quality_hold, 'On quality hold') +
      kpi(counts.complete + ' of ' + data.orders.length, 'Orders complete') +
      kpi(closed ? Math.round(100 * onTime / closed) + '%' : '—', 'Finished on time');
    el.clock.innerHTML = clockText(now) + '<small>' + (now >= data.shiftMinutes ? 'Shift over' : 'Simulated shift time') + '</small>';
  }
  function kpi(v, label) { return '<div class="kpi"><b>' + v + '</b><span>' + label + '</span></div>'; }

  function tick(ts) {
    if (!playing) return;
    if (last) t = Math.min(data.shiftMinutes, t + ((ts - last) / 1000) * speed);
    last = ts;
    render();
    if (t >= data.shiftMinutes) { setPlaying(false); return; }
    timer = requestAnimationFrame(tick);
  }

  function setPlaying(p) {
    playing = p;
    el.play.textContent = p ? 'Pause' : (t >= data.shiftMinutes ? 'Shift over' : 'Play');
    el.play.disabled = !p && t >= data.shiftMinutes;
    last = 0;
    if (p) timer = requestAnimationFrame(tick); else if (timer) cancelAnimationFrame(timer);
  }

  fetch('board.json').then(function (r) { return r.json(); }).then(function (d) {
    data = d;
    el.play.addEventListener('click', function () { setPlaying(!playing); });
    el.speed.addEventListener('change', function () { speed = Number(el.speed.value); });
    el.restart.addEventListener('click', function () { t = 0; render(); setPlaying(true); });
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    t = reduce ? 150 : 0;   // reduced motion: start paused part-way through the shift
    render();
    setPlaying(!reduce);
  }).catch(function () {
    el.lines.textContent = 'The demo data could not be loaded.';
  });
})();
