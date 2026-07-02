(function () {
  var oddsIds = ['b1a', 'b1b', 'b2a', 'b2b', 'b3a', 'b3b', 'b4a', 'b4b'];
  var allIds = oddsIds.concat(['stake', 'labelA', 'labelB', 'name1', 'name2', 'name3', 'name4']);
  var el = {};
  allIds.forEach(function (id) { el[id] = document.getElementById(id); });
  var resultEl = document.getElementById('result');
  var calcBtn = document.getElementById('calc');
  var betBtn = document.getElementById('bet');
  var resetBtn = document.getElementById('reset');
  var loadExampleBtn = document.getElementById('loadExample');
  var lastArbResult = null;
  var exampleLoaded = false;

  /** Parse odds: decimal (e.g. 2.10) or American (+120, -120). Returns decimal odds or NaN. */
  function parseOdds(str) {
    var s = String(str).trim();
    if (!s) return NaN;
    if (s.charAt(0) === '+' || s.charAt(0) === '-') {
      var american = parseInt(s, 10);
      if (isNaN(american) || american === 0) return NaN;
      if (american > 0) return 1 + american / 100;
      return 1 + 100 / Math.abs(american);
    }
    var dec = parseFloat(s);
    return (isNaN(dec) || dec < 1.01) ? NaN : dec;
  }

  /** Parse Polymarket price: .xx or 0.xx (0.01–1). Returns decimal odds (1/price) or NaN. */
  function parsePolymarketPrice(str) {
    var s = String(str).trim();
    if (!s) return NaN;
    var price = parseFloat(s);
    if (isNaN(price) || price < 0.01 || price > 1) return NaN;
    return 1 / price;
  }

  /** Format decimal odds as Polymarket price .xx (e.g. 2.56 -> ".39"). Never returns "..xx". */
  function formatPolymarketPrice(decimalOdds) {
    if (decimalOdds <= 0 || !isFinite(decimalOdds)) return '0.00';
    var p = 1 / decimalOdds;
    if (p > 1 || p <= 0) return p.toFixed(2);
    var cents = Math.round(p * 100);
    if (cents <= 0 || cents >= 100) return p.toFixed(2);
    return '.' + (cents < 10 ? '0' : '') + cents;
  }

  /** Format odds for arb-found line: Polymarket "$.yy", DK/FD "+yyy" or "-yyy". */
  function formatArbOdds(bookIdx, decimalOdds) {
    if (bookIdx === 2) return '$' + formatPolymarketPrice(decimalOdds);
    if (decimalOdds >= 2) return '+' + Math.round((decimalOdds - 1) * 100);
    return String(Math.round(-100 / (decimalOdds - 1)));
  }

  function bookToSite(bookName) {
    var p = String(bookName || '').trim().toLowerCase();
    if (p.indexOf('polymarket') !== -1) return 'Poly';
    if (p.indexOf('draft') !== -1 && p.indexOf('king') !== -1) return 'DK';
    if (p.indexOf('fan') !== -1 && p.indexOf('duel') !== -1) return 'FD';
    return bookName || '';
  }

  /** Format number with commas and 2 decimal places (for currency). */
  function formatMoney(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Live implied probability badges ---

  oddsIds.forEach(function (id) {
    var badge = document.getElementById('imp-' + id);
    var isPolymarket = id === 'b3a' || id === 'b3b';
    el[id].addEventListener('input', function () {
      if (isPolymarket) {
        var price = parseFloat(String(el[id].value).trim());
        if (!isNaN(price) && price >= 0.01 && price <= 1) {
          badge.textContent = (price * 100).toFixed(1) + '% implied';
        } else {
          badge.textContent = '';
        }
        return;
      }
      var dec = parseOdds(el[id].value);
      if (!isNaN(dec) && dec >= 1.01) {
        badge.textContent = (100 / dec).toFixed(1) + '% implied';
      } else {
        badge.textContent = '';
      }
    });
  });

  // --- Sync outcome labels into card headers ---

  function syncLabels() {
    document.querySelectorAll('.odds-label[data-outcome="A"]').forEach(function (s) {
      s.textContent = 'Bet A Odds';
    });
    document.querySelectorAll('.odds-label[data-outcome="B"]').forEach(function (s) {
      s.textContent = 'Bet B Odds';
    });
    var label3a = document.getElementById('label3a');
    var label3b = document.getElementById('label3b');
    if (label3a) label3a.textContent = 'Bet A Odds';
    if (label3b) label3b.textContent = 'Bet B Odds';
  }

  el.labelA.addEventListener('input', syncLabels);
  el.labelB.addEventListener('input', syncLabels);
  syncLabels();

  // --- Stake input: $ prefix and comma formatting ---
  function formatStakeDisplay(val) {
    var digits = String(val).replace(/\D/g, '');
    if (digits === '') return '';
    var n = parseInt(digits, 10);
    if (isNaN(n) || n < 0) return '';
    return n.toLocaleString();
  }

  if (el.stake) {
    el.stake.addEventListener('input', function () {
      var formatted = formatStakeDisplay(el.stake.value);
      if (formatted !== el.stake.value) {
        var start = el.stake.selectionStart;
        var prevLen = el.stake.value.length;
        el.stake.value = formatted;
        var newLen = el.stake.value.length;
        var newStart = Math.max(0, start + (newLen - prevLen));
        el.stake.setSelectionRange(newStart, newStart);
      }
    });
  }

  function parseStake() {
    var raw = (el.stake && el.stake.value) ? el.stake.value.replace(/,/g, '') : '';
    var n = parseInt(raw, 10);
    return (isNaN(n) || n <= 0) ? 1000 : n;
  }

  // --- Calculate ---

  function getBookNames() {
    var names = [
      el.name1 && (el.name1.value || 'Draft Kings'),
      el.name2 && (el.name2.value || 'Fan Duel'),
      el.name3 && (el.name3.value || 'Polymarket')
    ];
    var book4Card = document.getElementById('book4Card');
    if (book4Card && !book4Card.classList.contains('hidden') && el.name4) {
      names.push(el.name4.value || 'Book 4');
    }
    return names;
  }

  function getOutcomeLabels() {
    return [
      el.labelA.value || 'Outcome A',
      el.labelB.value || 'Outcome B'
    ];
  }

  function showResult(html, cls) {
    resultEl.innerHTML = html;
    resultEl.className = 'result ' + (cls || '');
  }

  function clearBestMarkers() {
    document.querySelectorAll('.odds-input.best').forEach(function (inp) {
      inp.classList.remove('best');
    });
  }

  function run() {
    clearBestMarkers();
    lastArbResult = null;

    var book4Card = document.getElementById('book4Card');
    var numBooks = (book4Card && !book4Card.classList.contains('hidden')) ? 4 : 3;
    var oddsA = [
      parseOdds(el.b1a && el.b1a.value),
      parseOdds(el.b2a && el.b2a.value),
      parsePolymarketPrice(el.b3a && el.b3a.value)
    ];
    var oddsB = [
      parseOdds(el.b1b && el.b1b.value),
      parseOdds(el.b2b && el.b2b.value),
      parsePolymarketPrice(el.b3b && el.b3b.value)
    ];
    if (numBooks === 4) {
      oddsA.push(parseOdds(el.b4a && el.b4a.value));
      oddsB.push(parseOdds(el.b4b && el.b4b.value));
    }

    function isValid(x) { return !isNaN(x) && x >= 1.01; }
    var hasValidA = oddsA.some(isValid);
    var hasValidB = oddsB.some(isValid);
    if (!hasValidA || !hasValidB) {
      showResult(
        '<h3>Invalid input</h3><p>Enter odds for at least one book per outcome (A and B).</p>',
        'error'
      );
      return;
    }

    var books = getBookNames();
    var labels = getOutcomeLabels();

    var bestA = -1, bookA = -1;
    var bestB = -1, bookB = -1;
    for (var i = 0; i < numBooks; i++) {
      if (isValid(oddsA[i]) && oddsA[i] > bestA) { bestA = oddsA[i]; bookA = i; }
      if (isValid(oddsB[i]) && oddsB[i] > bestB) { bestB = oddsB[i]; bookB = i; }
    }
    if (bookA === bookB) {
      var sameBookName = books[bookA] || 'that book';
      showResult(
        '<h3>Arbitrage Not Found</h3><p>Best odds for both outcomes are at the same book (<strong>' + sameBookName + '</strong>). Use two different books so outcome A is best at one and outcome B at another.</p>',
        'error'
      );
      return;
    }

    // Highlight best odds inputs
    var bestAIds = ['b1a', 'b2a', 'b3a', 'b4a'];
    var bestBIds = ['b1b', 'b2b', 'b3b', 'b4b'];
    var bestAId = bestAIds[bookA];
    var bestBId = bestBIds[bookB];
    el[bestAId].classList.add('best');
    el[bestBId].classList.add('best');

    var pA = 1 / bestA;
    var pB = 1 / bestB;
    var sumP = pA + pB;

    function oddsOrPrice(bookIdx, bestOdds) {
      return bookIdx === 2 ? 'price ' + formatPolymarketPrice(bestOdds) : 'odds ' + bestOdds.toFixed(2);
    }

    if (sumP >= 1) {
      var overround = (sumP * 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      var S = parseStake();
      var stakeA = S * (pA / sumP);
      var stakeB = S * (pB / sumP);
      var payoutIfA = stakeA * bestA;
      var payoutIfB = stakeB * bestB;
      var lossIfA = payoutIfA - S;
      var lossIfB = payoutIfB - S;
      showResult(
        '<h3>Arbitrage Not Found</h3>' +
        '<p>Combined implied probability is <strong>' + overround + '%</strong> (needs to be below 100%). Do not place these bets for guaranteed profit.</p>',
        'no-arb'
      );
      return;
    }

    var S = parseStake();
    var stakeA = S * (pA / sumP);
    var stakeB = S * (pB / sumP);
    var payout = S / sumP;
    var profit = payout - S;
    var profitPct = ((1 / sumP - 1) * 100).toFixed(2);
    var arbScore = (sumP * 100).toFixed(2);

    showResult(
      '<h3>Arbitrage Found (' + arbScore + '%) - Place Following Bets</h3>' +
      '<div class="arb-bet">' +
        '<div class="arb-bet-header">Bet 1: $' + formatMoney(stakeA) + ' on ' + labels[0] + ' on ' + bookToSite(books[bookA]) + ' @ ' + formatArbOdds(bookA, bestA) + '</div>' +
        '<div class="arb-bet-detail arb-bet-detail-line">Total Received: $' + formatMoney(payout) + ' | Profit: $' + formatMoney(profit) + '</div>' +
      '</div>' +
      '<div class="arb-bet">' +
        '<div class="arb-bet-header">Bet 2: $' + formatMoney(stakeB) + ' on ' + labels[1] + ' on ' + bookToSite(books[bookB]) + ' @ ' + formatArbOdds(bookB, bestB) + '</div>' +
        '<div class="arb-bet-detail arb-bet-detail-line">Total Received: $' + formatMoney(payout) + ' | Profit: $' + formatMoney(profit) + '</div>' +
      '</div>' +
      '<div class="summary">' +
        '% Profit: <strong>' + profitPct + '%</strong> &nbsp;|&nbsp; Profit: <strong>$' + formatMoney(profit) + '</strong> &nbsp;|&nbsp; Total Bet: <strong>$' + formatMoney(S) + '</strong> &nbsp;|&nbsp; Payout: <strong>$' + formatMoney(payout) + '</strong>' +
      '</div>',
      'profit'
    );

    lastArbResult = {
      date: getTodayMountainDateString(),
      game: labels[0] + ' / ' + labels[1],
      labels: labels,
      books: books,
      bookA: bookA,
      bookB: bookB,
      bestA: bestA,
      bestB: bestB,
      oddsOrPriceA: oddsOrPrice(bookA, bestA),
      oddsOrPriceB: oddsOrPrice(bookB, bestB),
      stakeA: stakeA,
      stakeB: stakeB,
      payout: payout,
      profit: profit,
      profitPct: profitPct
    };
  }

  var BET_LOG_KEY = 'arbBetLog';
  var UI_STATE_KEY = 'arbCalculatorUIState';

  /** Today's date in Mountain time (America/Denver), formatted m-d-yyyy (used for log and display). */
  function getTodayMountainDateString() {
    var s = new Date().toLocaleDateString('en-US', { timeZone: 'America/Denver' });
    var parts = s.split('/');
    if (parts.length !== 3) return s;
    return parts[0] + '-' + parts[1] + '-' + parts[2];
  }

  function updateLogDateDisplay() {
    var el = document.getElementById('logDateDisplay');
    if (el) el.textContent = getTodayMountainDateString();
  }

  /** Format date string (YYYY-MM-DD or m-d-yyyy) to m-d-yyyy for display. */
  function formatDateToMDY(str) {
    if (!str || !String(str).trim()) return '';
    var s = String(str).trim();
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var y = d.getFullYear();
    return m + '-' + day + '-' + y;
  }

  /** Format date string to m/d/yy for chart x-axis. */
  function formatDateToSlashMDY(str) {
    if (!str || !String(str).trim()) return '';
    var d = new Date(String(str).trim());
    if (isNaN(d.getTime())) return str;
    var m = d.getMonth() + 1;
    var day = d.getDate();
    var y = String(d.getFullYear()).slice(-2);
    return m + '/' + day + '/' + y;
  }

  function getLogFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(BET_LOG_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  /** One-time: change any log entry with date 3/10 to 3/11 (only when date is March 10). */
  function migrateMarch10ToMarch11InLog() {
    try {
      var log = getLogFromStorage();
      var changed = false;
      for (var i = 0; i < log.length; i++) {
        var dateStr = log[i] && log[i].Date ? String(log[i].Date).trim() : '';
        if (!dateStr) continue;
        var d = new Date(dateStr);
        if (isNaN(d.getTime())) continue;
        if (d.getMonth() !== 2 || d.getDate() !== 10) continue; // not March 10
        var y = d.getFullYear();
        log[i].Date = '3-11-' + y;
        changed = true;
      }
      if (changed) {
        localStorage.setItem(BET_LOG_KEY, JSON.stringify(log));
      }
    } catch (e) {}
  }

  function parseLogNum(val) {
    var n = parseFloat(String(val != null ? val : '').replace(/[$,%]/g, ''));
    return isNaN(n) ? 0 : n;
  }

  /** Get implied probability (0–1) from stored 'Odds or Price' (e.g. "odds 1.87" or "price .48"). Sum of both legs < 100% = bet. */
  function getImpliedFromLogOdds(str) {
    if (!str || !String(str).trim()) return NaN;
    var s = String(str).trim();
    if (s.indexOf('price ') === 0) {
      var price = parseFloat(s.slice(6).trim());
      return (isNaN(price) || price < 0.01 || price > 1) ? NaN : price;
    }
    if (s.indexOf('odds ') === 0) {
      var dec = parseFloat(s.slice(5).trim());
      return (isNaN(dec) || dec < 1.01) ? NaN : 1 / dec;
    }
    return NaN;
  }

  /** Format stored 'Odds or Price' (e.g. "odds 1.87" or "price .48") for log display in parens: (-120) or (.48). */
  function formatLogOdds(oddsOrPriceStr) {
    if (!oddsOrPriceStr) return '';
    var s = String(oddsOrPriceStr).trim();
    if (s.indexOf('price ') === 0) return s.slice(6).trim();
    if (s.indexOf('odds ') === 0) {
      var dec = parseFloat(s.slice(5));
      if (isNaN(dec) || dec < 1.01) return '';
      if (dec >= 2) return '+' + Math.round((dec - 1) * 100);
      return String(Math.round(-100 / (dec - 1)));
    }
    return '';
  }

  /** Normalize date string to YYYY-MM-DD for grouping (same calendar day = one bar). */
  function getDateKey(dateStr) {
    if (!dateStr || !String(dateStr).trim()) return '';
    var d = new Date(String(dateStr).trim());
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function getCumulativeProfitData() {
    var log = getLogFromStorage();
    var byDate = {};
    for (var i = 0; i < log.length; i += 2) {
      var rowA = log[i];
      var rowB = log[i + 1];
      var dateStr = rowA && rowA.Date ? String(rowA.Date).trim() : '';
      var profit = rowA ? parseLogNum(rowA.Profit) : 0;
      var amtA = rowA ? parseLogNum(rowA['Amount Bet']) : 0;
      var amtB = rowB ? parseLogNum(rowB['Amount Bet']) : 0;
      var amountBet = amtA + amtB;
      if (dateStr) {
        var dateMs = new Date(dateStr).getTime();
        if (!isNaN(dateMs)) {
          var key = getDateKey(dateStr);
          if (key) {
            if (!byDate[key]) byDate[key] = { dateStr: dateStr, dateMs: dateMs, profit: 0, amountBet: 0 };
            byDate[key].profit += profit;
            byDate[key].amountBet += amountBet;
          }
        }
      }
    }
    var points = Object.keys(byDate).map(function (k) { return byDate[k]; });
    points.sort(function (a, b) { return a.dateMs - b.dateMs; });
    var cum = 0;
    var runAmt = 0;
    var out = [];
    for (var j = 0; j < points.length; j++) {
      cum += points[j].profit;
      runAmt += points[j].amountBet;
      out.push({
        dateStr: points[j].dateStr,
        dateMs: points[j].dateMs,
        cumulative: cum,
        runningAmountBet: runAmt,
        runningArbs: j + 1,
        runningBets: 2 * (j + 1)
      });
    }
    return out;
  }

  function renderProfitChart() {
    var container = document.getElementById('profitChart');
    if (!container) return;
    var data = getCumulativeProfitData();
    container.innerHTML = '';
    if (data.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'chart-empty';
      empty.style.cssText = 'display:flex;align-items:center;justify-content:center;height:100%;min-height:160px;font-size:0.9rem;color:#71717a;font-style:italic;';
      empty.textContent = 'Log some bets to see profit over time';
      container.appendChild(empty);
      return;
    }
    var w = 800;
    var h = 200;
    var pad = { top: 10, right: 0, bottom: 32, left: 0 };
    var yAxisWidth = 52;
    var plotLeft = yAxisWidth;
    var plotRight = w;
    var plotWidth = plotRight - plotLeft;
    var plotH = h - pad.top - pad.bottom;
    var minCum = 0;
    var maxCum = 0;
    for (var i = 0; i < data.length; i++) {
      var c = data[i].cumulative;
      if (c < minCum) minCum = c;
      if (c > maxCum) maxCum = c;
    }
    var yMin = minCum >= 0 ? 0 : minCum;
    var yMax = maxCum <= 0 ? 0 : maxCum;
    var range = yMax - yMin;
    if (range === 0) range = 1;
    yMin = yMin - range * 0.03;
    yMax = yMax + range * 0.03;
    var yRange = yMax - yMin;
    var xScale = function (i) { return plotLeft + (i / Math.max(1, data.length - 1)) * plotWidth; };
    var yScale = function (v) { return pad.top + plotH - ((v - yMin) / yRange) * plotH; };
    var baseline = yScale(0);
    var pts = [];
    for (var idx = 0; idx < data.length; idx++) {
      pts.push({ x: xScale(idx), y: yScale(data[idx].cumulative) });
    }
    var useBarChart = data.length >= 1 && data.length <= 5;
    var yTickVals = [];
    if (yMin <= 0 && 0 <= yMax) {
      yTickVals.push(0);
      for (var n = 1; n <= 4; n++) {
        var v = (yMax / 4) * n;
        if (v > 0 && v <= yMax) yTickVals.push(v);
      }
    } else {
      for (var t = 0; t <= 5; t++) {
        yTickVals.push(yMin + (t / 5) * yRange);
      }
    }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'none');
    var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
    var getHoverX = null;
    if (useBarChart) {
      var unit = plotWidth / 10;
      var barWidth = unit;
      var gap = unit;
      var totalBarBlock = data.length * barWidth + (data.length - 1) * gap;
      var startX = plotLeft + (plotWidth - totalBarBlock) / 2;
      getHoverX = function (i) { return startX + i * (barWidth + gap) + barWidth / 2; };
      for (var bi = 0; bi < data.length; bi++) {
        var barLeft = startX + bi * (barWidth + gap);
        var cum = data[bi].cumulative;
        var barY = yScale(cum);
        var rectTop = cum >= 0 ? barY : baseline;
        var rectH = Math.abs(baseline - barY);
        if (rectH < 1) rectH = 1;
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', barLeft);
        rect.setAttribute('y', rectTop);
        rect.setAttribute('width', barWidth);
        rect.setAttribute('height', rectH);
        rect.setAttribute('class', 'chart-bar');
        rect.setAttribute('cursor', 'pointer');
        (function (idx) {
          rect.addEventListener('mouseenter', function (e) {
            var run = data[idx];
            var runPct = run.runningAmountBet > 0 ? ((run.cumulative / run.runningAmountBet) * 100).toFixed(2) : '0.00';
            var el = document.getElementById('profitChartTooltip');
            if (!el) {
              el = document.createElement('div');
              el.id = 'profitChartTooltip';
              el.className = 'profit-chart-tooltip';
              el.style.display = 'none';
              document.body.appendChild(el);
            }
            el.innerHTML =
              '<div class="tooltip-date">' + (formatDateToMDY(run.dateStr) || run.dateStr) + '</div>' +
              '<div class="tooltip-row">% Profit: ' + runPct + '%</div>' +
              '<div class="tooltip-row">Total Profit: $' + formatMoney(run.cumulative) + '</div>' +
              '<div class="tooltip-row">Total Amount Bet: $' + formatMoney(run.runningAmountBet) + '</div>';
            el.style.left = (e.clientX + 10) + 'px';
            el.style.top = (e.clientY + 10) + 'px';
            el.style.display = 'block';
          });
          rect.addEventListener('mouseleave', function () {
            var el = document.getElementById('profitChartTooltip');
            if (el) el.style.display = 'none';
          });
        })(bi);
        svg.appendChild(rect);
      }
    } else {
      function catmullRomToBezier(p0, p1, p2, p3) {
        var cp1x = p1.x + (p2.x - p0.x) / 6;
        var cp1y = p1.y + (p2.y - p0.y) / 6;
        var cp2x = p2.x - (p3.x - p1.x) / 6;
        var cp2y = p2.y - (p3.y - p1.y) / 6;
        return 'C' + cp1x + ',' + cp1y + ' ' + cp2x + ',' + cp2y + ' ' + p2.x + ',' + p2.y;
      }
      var smoothPath = 'M' + pts[0].x + ',' + pts[0].y;
      for (var k = 1; k < pts.length; k++) {
        var p0 = pts[k - 2] || pts[0];
        var p1 = pts[k - 1];
        var p2 = pts[k];
        var p3 = pts[k + 1] || pts[k];
        smoothPath += catmullRomToBezier(p0, p1, p2, p3);
      }
      var firstX = pts[0].x;
      var lastX = pts[pts.length - 1].x;
      var areaPath = smoothPath + 'L' + lastX + ',' + baseline + 'L' + firstX + ',' + baseline + 'Z';
      var area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      area.setAttribute('d', areaPath);
      area.setAttribute('class', 'chart-area');
      svg.appendChild(area);
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('d', smoothPath);
      line.setAttribute('class', 'chart-line');
      svg.appendChild(line);
    }
    var tooltipEl = document.getElementById('profitChartTooltip');
    if (!tooltipEl) {
      tooltipEl = document.createElement('div');
      tooltipEl.id = 'profitChartTooltip';
      tooltipEl.className = 'profit-chart-tooltip';
      tooltipEl.style.display = 'none';
      document.body.appendChild(tooltipEl);
    }
    var hoverGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    hoverGroup.setAttribute('class', 'chart-hover-group');
    for (var hi = 0; hi < pts.length; hi++) {
      var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', getHoverX ? getHoverX(hi) : pts[hi].x);
      circle.setAttribute('cy', pts[hi].y);
      circle.setAttribute('r', 12);
      circle.setAttribute('class', 'chart-hover-dot');
      circle.setAttribute('data-index', String(hi));
      (function (idx) {
        circle.addEventListener('mouseenter', function (e) {
          var run = data[idx];
          var runPct = run.runningAmountBet > 0 ? ((run.cumulative / run.runningAmountBet) * 100).toFixed(2) : '0.00';
          tooltipEl.innerHTML =
            '<div class="tooltip-date">' + (formatDateToMDY(run.dateStr) || run.dateStr) + '</div>' +
            '<div class="tooltip-row">% Profit: ' + runPct + '%</div>' +
            '<div class="tooltip-row">Total Profit: $' + formatMoney(run.cumulative) + '</div>' +
            '<div class="tooltip-row">Total Amount Bet: $' + formatMoney(run.runningAmountBet) + '</div>';
          tooltipEl.style.left = (e.clientX + 10) + 'px';
          tooltipEl.style.top = (e.clientY + 10) + 'px';
          tooltipEl.style.display = 'block';
        });
        circle.addEventListener('mouseleave', function () {
          tooltipEl.style.display = 'none';
        });
      })(hi);
      hoverGroup.appendChild(circle);
    }
    svg.appendChild(hoverGroup);
    for (var ti = 0; ti < yTickVals.length; ti++) {
      var yVal = yTickVals[ti];
      var yPos = yScale(yVal);
      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', 8);
      label.setAttribute('y', yPos + 4);
      label.setAttribute('text-anchor', 'start');
      label.setAttribute('class', 'chart-axis-text');
      label.textContent = '$' + formatMoney(yVal);
      svg.appendChild(label);
    }
    var xAxisY = h - 10;
    var dateIndices = [];
    var barCenterX = null;
    if (useBarChart) {
      for (var di = 0; di < data.length; di++) dateIndices.push(di);
      var unit = plotWidth / 10;
      var totalBarBlock = data.length * unit + (data.length - 1) * unit;
      var startX = plotLeft + (plotWidth - totalBarBlock) / 2;
      barCenterX = function (i) { return startX + i * (2 * unit) + unit / 2; };
    } else {
      var dateStep = Math.max(1, Math.floor(data.length / 6));
      for (var d = 0; d < data.length; d += dateStep) dateIndices.push(d);
      if (data.length > 0 && dateIndices.indexOf(data.length - 1) === -1) dateIndices.push(data.length - 1);
    }
    for (var di = 0; di < dateIndices.length; di++) {
      var d = dateIndices[di];
      var xPos = barCenterX ? barCenterX(d) : xScale(d);
      var dateLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dateLabel.setAttribute('x', xPos);
      dateLabel.setAttribute('y', xAxisY);
      dateLabel.setAttribute('text-anchor', 'middle');
      dateLabel.setAttribute('class', 'chart-axis-text');
      dateLabel.textContent = formatDateToSlashMDY(data[d].dateStr) || data[d].dateStr;
      svg.appendChild(dateLabel);
    }
    container.appendChild(svg);
  }

  function updateCalcKPIs() {
    var log = getLogFromStorage();
    var kpiAmount = document.getElementById('calcKpiAmount');
    var kpiProfit = document.getElementById('calcKpiProfit');
    var kpiPct = document.getElementById('calcKpiPct');
    if (!kpiAmount || !kpiProfit || !kpiPct) return;
    var totalAmountBet = 0;
    var totalProfit = 0;
    for (var i = 0; i < log.length; i++) {
      totalAmountBet += parseLogNum(log[i]['Amount Bet']);
      if (i % 2 === 0) totalProfit += parseLogNum(log[i].Profit);
    }
    var pctVal = totalAmountBet > 0 ? (totalProfit / totalAmountBet) * 100 : 0;
    kpiAmount.textContent = '$' + (totalAmountBet > 0 ? formatMoney(totalAmountBet) : '0.00');
    kpiProfit.textContent = '$' + formatMoney(totalProfit);
    kpiProfit.className = 'calc-kpi-value' + (totalProfit >= 0 ? ' positive' : ' negative');
    kpiPct.textContent = pctVal.toFixed(1) + '%';
    kpiPct.className = 'calc-kpi-value' + (pctVal >= 0 ? ' positive' : ' negative');
  }

  function renderCalcLog() {
    updateCalcKPIs();
    renderProfitChart();
    updateLogDateDisplay();
    var tableWrap = document.getElementById('calcLogTableWrap');
    var emptyEl = document.getElementById('calcLogEmpty');
    if (!tableWrap || !emptyEl) return;
    var log = getLogFromStorage();
    if (log.length === 0) {
      tableWrap.innerHTML = '';
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');
    function platformToSite(platform) {
      var p = String(platform || '').trim().toLowerCase();
      if (p.indexOf('polymarket') !== -1) return 'Poly';
      if (p.indexOf('draft') !== -1 && p.indexOf('king') !== -1) return 'DK';
      if (p.indexOf('fan') !== -1 && p.indexOf('duel') !== -1) return 'FD';
      return platform || '';
    }
    var table = document.createElement('table');
    table.className = 'calc-log-table';
    table.setAttribute('role', 'table');
    var colgroup = document.createElement('colgroup');
    [3, 10, 32, 12, 32, 12, 16, 8].forEach(function (w) {
      var col = document.createElement('col');
      col.style.width = w + 'ch';
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    var headCells = ['', 'Date', 'Bet 1', 'Bet 1 amt', 'Bet 2', 'Bet 2 amt', 'Profit', 'Arb %'];
    headCells.forEach(function (h) {
      var th = document.createElement('th');
      th.className = 'calc-log-th calc-log-th--center';
      th.textContent = h;
      th.style.textAlign = 'center';
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = document.createElement('tbody');
    for (var i = 0; i < log.length; i += 2) {
      var rowA = log[i];
      var rowB = log[i + 1];
      var out1 = String(rowA.Outcome || '').replace(/\bOver\b/gi, 'O').replace(/\bUnder\b/gi, 'U');
      var odds1 = formatLogOdds(rowA['Odds or Price']);
      var bet1 = out1 + (odds1 ? ' (' + odds1 + ')' : '') + ' @ ' + platformToSite(rowA.Platform);
      var bet1Amt = rowA['Amount Bet'] != null ? '$' + rowA['Amount Bet'] : '';
      var out2 = rowB ? String(rowB.Outcome || '').replace(/\bOver\b/gi, 'O').replace(/\bUnder\b/gi, 'U') : '';
      var odds2 = rowB ? formatLogOdds(rowB['Odds or Price']) : '';
      var bet2 = rowB ? out2 + (odds2 ? ' (' + odds2 + ')' : '') + ' @ ' + platformToSite(rowB.Platform) : '';
      var bet2Amt = rowB && rowB['Amount Bet'] != null ? '$' + rowB['Amount Bet'] : '';
      var totalAmt = parseLogNum(rowA['Amount Bet']) + (rowB ? parseLogNum(rowB['Amount Bet']) : 0);
      var profitNum = parseLogNum(rowA.Profit);
      var profitPctStr = totalAmt > 0 ? (profitNum / totalAmt * 100).toFixed(2) : '0.00';
      var profit = rowA.Profit != null ? '$' + rowA.Profit + ' (' + profitPctStr + '%)' : '';
      var impliedA = getImpliedFromLogOdds(rowA['Odds or Price']);
      var impliedB = rowB ? getImpliedFromLogOdds(rowB['Odds or Price']) : NaN;
      var arbPctStr = (!isNaN(impliedA) && !isNaN(impliedB)) ? ((impliedA + impliedB) * 100).toFixed(2) : '—';
      var tr = document.createElement('tr');
      var deleteCell = document.createElement('td');
      deleteCell.className = 'calc-log-td calc-log-td--center';
      var deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'log-row-delete';
      deleteBtn.setAttribute('aria-label', 'Delete entry');
      deleteBtn.textContent = '×';
      deleteBtn.dataset.startIndex = String(i);
      deleteBtn.addEventListener('click', function () {
        var start = parseInt(this.dataset.startIndex, 10);
        var logData = getLogFromStorage();
        logData.splice(start, 2);
        try {
          localStorage.setItem(BET_LOG_KEY, JSON.stringify(logData));
        } catch (e) {}
        renderCalcLog();
      });
      deleteCell.appendChild(deleteBtn);
      tr.appendChild(deleteCell);
      var cellData = [
        { text: formatDateToMDY(rowA.Date) || '', align: 'center' },
        { text: bet1, align: 'left' },
        { text: bet1Amt, align: 'center' },
        { text: bet2, align: 'left' },
        { text: bet2Amt, align: 'center' },
        { text: profit, align: 'center' },
        { text: arbPctStr === '—' ? arbPctStr : arbPctStr + '%', align: 'center' }
      ];
      cellData.forEach(function (item) {
        var td = document.createElement('td');
        td.className = 'calc-log-td calc-log-td--' + item.align;
        td.style.textAlign = item.align;
        td.textContent = item.text;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrap.innerHTML = '';
    tableWrap.appendChild(table);
  }

  function appendArbToLog(arb) {
    try {
      var log = getLogFromStorage();
      var rowA = {
        Date: arb.date,
        Game: arb.game,
        Outcome: arb.labels[0],
        Platform: arb.books[arb.bookA],
        'Odds or Price': arb.oddsOrPriceA,
        'Amount Bet': formatMoney(arb.stakeA),
        Payout: formatMoney(arb.payout),
        Profit: formatMoney(arb.profit),
        'Profit Pct': arb.profitPct + '%',
        Notes: ''
      };
      var rowB = {
        Date: arb.date,
        Game: arb.game,
        Outcome: arb.labels[1],
        Platform: arb.books[arb.bookB],
        'Odds or Price': arb.oddsOrPriceB,
        'Amount Bet': formatMoney(arb.stakeB),
        Payout: formatMoney(arb.payout),
        Profit: formatMoney(arb.profit),
        'Profit Pct': arb.profitPct + '%',
        Notes: ''
      };
      log.push(rowA);
      log.push(rowB);
      localStorage.setItem(BET_LOG_KEY, JSON.stringify(log));
      renderCalcLog();
    } catch (e) {}
  }

  migrateMarch10ToMarch11InLog();
  renderCalcLog();

  function saveUIState() {
    var profitChartWrap = document.getElementById('profitChartWrap');
    var calcKpiSection = document.getElementById('calcKpiSection');
    var calculatorSection = document.getElementById('calculatorSection');
    var calcLogSection = document.getElementById('calcLogSection');
    var state = {
      labelA: el.labelA && el.labelA.value,
      labelB: el.labelB && el.labelB.value,
      name1: el.name1 && el.name1.value,
      name2: el.name2 && el.name2.value,
      name3: el.name3 && el.name3.value,
      b1a: el.b1a && el.b1a.value,
      b1b: el.b1b && el.b1b.value,
      b2a: el.b2a && el.b2a.value,
      b2b: el.b2b && el.b2b.value,
      b3a: el.b3a && el.b3a.value,
      b3b: el.b3b && el.b3b.value,
      stake: el.stake && el.stake.value,
      resultClassName: resultEl && resultEl.className,
      resultHTML: resultEl && resultEl.innerHTML,
      chartCollapsed: profitChartWrap ? profitChartWrap.classList.contains('collapsed') : false,
      kpiCollapsed: calcKpiSection ? calcKpiSection.classList.contains('collapsed') : false,
      calculatorHidden: calculatorSection ? calculatorSection.classList.contains('hidden') : false,
      logHidden: calcLogSection ? calcLogSection.classList.contains('hidden') : false,
      fourthBookVisible: (function () {
        var card = document.getElementById('book4Card');
        return card ? !card.classList.contains('hidden') : false;
      })(),
      name4: el.name4 && el.name4.value,
      b4a: el.b4a && el.b4a.value,
      b4b: el.b4b && el.b4b.value
    };
    try {
      localStorage.setItem(UI_STATE_KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function restoreUIState() {
    try {
      var raw = localStorage.getItem(UI_STATE_KEY);
      if (!raw) return;
      var state = JSON.parse(raw);
      if (el.labelA) el.labelA.value = (state.labelA && state.labelA !== 'Outcome A' ? state.labelA : '');
      if (el.labelB) el.labelB.value = (state.labelB && state.labelB !== 'Outcome B' ? state.labelB : '');
      if (state.name1 != null && el.name1) el.name1.value = state.name1;
      if (state.name2 != null && el.name2) el.name2.value = state.name2;
      if (state.name3 != null && el.name3) el.name3.value = state.name3;
      if (state.b1a != null && el.b1a) el.b1a.value = state.b1a;
      if (state.b1b != null && el.b1b) el.b1b.value = state.b1b;
      if (state.b2a != null && el.b2a) el.b2a.value = state.b2a;
      if (state.b2b != null && el.b2b) el.b2b.value = state.b2b;
      if (state.b3a != null && el.b3a) el.b3a.value = state.b3a;
      if (state.b3b != null && el.b3b) el.b3b.value = state.b3b;
      if (state.name4 != null && el.name4) el.name4.value = state.name4;
      if (state.b4a != null && el.b4a) el.b4a.value = state.b4a;
      if (state.b4b != null && el.b4b) el.b4b.value = state.b4b;
      if (el.stake) el.stake.value = (state.stake && state.stake.replace(/,/g, '') !== '' && state.stake !== '1,000' ? state.stake : '');
      syncLabels();
      var book4Card = document.getElementById('book4Card');
      var addBookBtn = document.getElementById('addBookBtn');
      if (book4Card && addBookBtn && state.fourthBookVisible != null) {
        var booksContainer = document.getElementById('booksContainer');
        if (state.fourthBookVisible) {
          book4Card.classList.remove('hidden');
          if (booksContainer) booksContainer.classList.add('four-books');
          addBookBtn.textContent = '- Book';
          addBookBtn.setAttribute('aria-label', 'Remove fourth book');
        } else {
          book4Card.classList.add('hidden');
          if (booksContainer) booksContainer.classList.remove('four-books');
          addBookBtn.textContent = '+ Book';
          addBookBtn.setAttribute('aria-label', 'Add fourth book');
        }
      }
      oddsIds.forEach(function (id) {
        var badge = document.getElementById('imp-' + id);
        if (badge && el[id]) {
          var isPolymarket = id === 'b3a' || id === 'b3b';
          if (isPolymarket) {
            var price = parseFloat(String(el[id].value).trim());
            badge.textContent = !isNaN(price) && price >= 0.01 && price <= 1 ? (price * 100).toFixed(1) + '% implied' : '';
          } else {
            var dec = parseOdds(el[id].value);
            badge.textContent = !isNaN(dec) && dec >= 1.01 ? (100 / dec).toFixed(1) + '% implied' : '';
          }
        }
      });
      if (resultEl && state.resultClassName != null) resultEl.className = state.resultClassName;
      if (resultEl && state.resultHTML != null) resultEl.innerHTML = state.resultHTML;
      var profitChartWrap = document.getElementById('profitChartWrap');
      var profitChartSection = profitChartWrap && profitChartWrap.closest('.profit-chart-section');
      var areaGraphToggleBtn = document.getElementById('areaGraphToggleBtn');
      if (profitChartWrap && state.chartCollapsed != null) {
        if (state.chartCollapsed) {
          profitChartWrap.classList.add('collapsed');
          if (profitChartSection) profitChartSection.classList.add('collapsed');
          if (areaGraphToggleBtn) areaGraphToggleBtn.setAttribute('aria-label', 'Show area chart');
        } else {
          profitChartWrap.classList.remove('collapsed');
          if (profitChartSection) profitChartSection.classList.remove('collapsed');
          if (areaGraphToggleBtn) areaGraphToggleBtn.setAttribute('aria-label', 'Hide area chart');
        }
      }
      var calcKpiSection = document.getElementById('calcKpiSection');
      var kpiToggleBtn = document.getElementById('kpiToggleBtn');
      if (calcKpiSection && state.kpiCollapsed != null) {
        if (state.kpiCollapsed) {
          calcKpiSection.classList.add('collapsed');
          if (kpiToggleBtn) kpiToggleBtn.setAttribute('aria-label', 'Show KPI cards');
        } else {
          calcKpiSection.classList.remove('collapsed');
          if (kpiToggleBtn) kpiToggleBtn.setAttribute('aria-label', 'Hide KPI cards');
        }
      }
      var calculatorSection = document.getElementById('calculatorSection');
      var calcLogSection = document.getElementById('calcLogSection');
      var calculatorToggleBtn = document.getElementById('calculatorToggleBtn');
      var logToggleBtn = document.getElementById('logToggleBtn');
      if (calculatorSection && state.calculatorHidden != null) {
        if (state.calculatorHidden) {
          calculatorSection.classList.add('hidden');
          if (calculatorToggleBtn) calculatorToggleBtn.setAttribute('aria-label', 'Show calculator');
        } else {
          calculatorSection.classList.remove('hidden');
          if (calculatorToggleBtn) calculatorToggleBtn.setAttribute('aria-label', 'Hide calculator');
        }
      }
      if (calcLogSection && state.logHidden != null) {
        if (state.logHidden) {
          calcLogSection.classList.add('hidden');
          if (logToggleBtn) logToggleBtn.setAttribute('aria-label', 'Show log');
        } else {
          calcLogSection.classList.remove('hidden');
          if (logToggleBtn) logToggleBtn.setAttribute('aria-label', 'Hide log');
        }
      }
    } catch (e) {}
  }

  restoreUIState();

  var saveStateBtn = document.getElementById('saveStateBtn');
  if (saveStateBtn) saveStateBtn.addEventListener('click', saveUIState);

  var profitChartWrap = document.getElementById('profitChartWrap');
  var profitChartSection = profitChartWrap && profitChartWrap.closest('.profit-chart-section');
  var areaGraphToggleBtn = document.getElementById('areaGraphToggleBtn');
  if (areaGraphToggleBtn && profitChartWrap) {
    areaGraphToggleBtn.addEventListener('click', function () {
      var collapsed = profitChartWrap.classList.toggle('collapsed');
      if (profitChartSection) profitChartSection.classList.toggle('collapsed', collapsed);
      areaGraphToggleBtn.setAttribute('aria-label', collapsed ? 'Show area chart' : 'Hide area chart');
    });
  }
  var calcKpiSection = document.getElementById('calcKpiSection');
  var kpiToggleBtn = document.getElementById('kpiToggleBtn');
  if (kpiToggleBtn && calcKpiSection) {
    kpiToggleBtn.addEventListener('click', function () {
      var collapsed = calcKpiSection.classList.toggle('collapsed');
      kpiToggleBtn.setAttribute('aria-label', collapsed ? 'Show KPI cards' : 'Hide KPI cards');
    });
  }
  var book4Card = document.getElementById('book4Card');
  var addBookBtn = document.getElementById('addBookBtn');
  if (addBookBtn && book4Card) {
    var booksContainer = document.getElementById('booksContainer');
    addBookBtn.addEventListener('click', function () {
      book4Card.classList.toggle('hidden');
      var visible = !book4Card.classList.contains('hidden');
      if (booksContainer) {
        if (visible) booksContainer.classList.add('four-books');
        else booksContainer.classList.remove('four-books');
      }
      addBookBtn.textContent = visible ? '- Book' : '+ Book';
      addBookBtn.setAttribute('aria-label', visible ? 'Remove fourth book' : 'Add fourth book');
    });
  }
  var calculatorSection = document.getElementById('calculatorSection');
  var calculatorToggleBtn = document.getElementById('calculatorToggleBtn');
  if (calculatorToggleBtn && calculatorSection) {
    calculatorToggleBtn.addEventListener('click', function () {
      var hidden = calculatorSection.classList.toggle('hidden');
      calculatorToggleBtn.setAttribute('aria-label', hidden ? 'Show calculator' : 'Hide calculator');
    });
  }
  var calcLogSection = document.getElementById('calcLogSection');
  var logToggleBtn = document.getElementById('logToggleBtn');
  if (logToggleBtn && calcLogSection) {
    logToggleBtn.addEventListener('click', function () {
      var hidden = calcLogSection.classList.toggle('hidden');
      logToggleBtn.setAttribute('aria-label', hidden ? 'Show log' : 'Hide log');
    });
  }

  updateLogDateDisplay();

  calcBtn.addEventListener('click', run);

  // --- Enter key to calculate ---

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      run();
    }
  });

  // --- Reset ---

  resetBtn.addEventListener('click', function () {
    clearBestMarkers();
    oddsIds.forEach(function (id) {
      el[id].value = '';
      document.getElementById('imp-' + id).textContent = '';
    });
    el.stake.value = '';
    el.labelA.value = '';
    el.labelB.value = '';
    el.name1.value = 'Draft Kings';
    el.name2.value = 'Fan Duel';
    el.name3.value = 'Polymarket';
    syncLabels();
    resultEl.className = 'result hidden';
    resultEl.innerHTML = '';
    lastArbResult = null;
  });

  // --- Bet: log current arb ---

  if (betBtn) {
    betBtn.addEventListener('click', function () {
      if (lastArbResult) {
        appendArbToLog(lastArbResult);
        lastArbResult = null;
      }
    });
  }

  // --- Load example: NBA player O/U rebounds (realistic arb template) ---

  function updateImpliedBadge(id) {
    var badge = document.getElementById('imp-' + id);
    if (!badge) return;
    var isPolymarket = id === 'b3a' || id === 'b3b';
    if (isPolymarket) {
      var price = parseFloat(String(el[id].value).trim());
      badge.textContent = !isNaN(price) && price >= 0.01 && price <= 1 ? (price * 100).toFixed(1) + '% implied' : '';
    } else {
      var dec = parseOdds(el[id].value);
      badge.textContent = !isNaN(dec) && dec >= 1.01 ? (100 / dec).toFixed(1) + '% implied' : '';
    }
  }

  function clearExampleAndReset() {
    clearBestMarkers();
    oddsIds.forEach(function (id) {
      el[id].value = '';
      document.getElementById('imp-' + id).textContent = '';
    });
    el.stake.value = '';
    el.labelA.value = '';
    el.labelB.value = '';
    el.name1.value = 'Draft Kings';
    el.name2.value = 'Fan Duel';
    el.name3.value = 'Polymarket';
    syncLabels();
    resultEl.className = 'result hidden';
    resultEl.innerHTML = '';
    lastArbResult = null;
    exampleLoaded = false;
    renderCalcLog();
  }

  if (loadExampleBtn) {
    loadExampleBtn.addEventListener('click', function () {
      if (exampleLoaded) {
        clearExampleAndReset();
        return;
      }
      clearBestMarkers();
      el.labelA.value = 'Poeltl O 8.5 Rebs';
      el.labelB.value = 'Poeltl U 8.5 Rebs';
      el.name1.value = 'Draft Kings';
      el.name2.value = 'Fan Duel';
      el.name3.value = 'Polymarket';
      el.b1a.value = '+105';
      el.b1b.value = '-130';
      el.b2a.value = '-115';
      el.b2b.value = '+100';
      el.b3a.value = '.48';
      el.b3b.value = '.52';
      el.stake.value = '100';
      syncLabels();
      oddsIds.forEach(updateImpliedBadge);
      run();
      exampleLoaded = true;
    });
  }
})();
