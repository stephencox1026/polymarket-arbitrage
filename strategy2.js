(function () {
  var oddsIds = ['b1o', 'b1u', 'b2o', 'b2u', 'b3o', 'b3u', 'b4o', 'b4u'];
  var lineIds = ['line1', 'line2', 'line3', 'line4'];
  var nameIds = ['name1', 'name2', 'name3', 'name4'];
  var allIds = oddsIds.concat(lineIds).concat(nameIds).concat(['stake', 'propLabel']);
  var el = {};
  allIds.forEach(function (id) { el[id] = document.getElementById(id); });
  var resultEl = document.getElementById('result');
  var calcBtn = document.getElementById('calc');
  var betBtn = document.getElementById('bet');
  var resetBtn = document.getElementById('reset');
  var loadExampleBtn = document.getElementById('loadExample');
  var lastArbResult = null;
  var exampleLoaded = false;

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

  function parsePolymarketPrice(str) {
    var s = String(str).trim();
    if (!s) return NaN;
    var price = parseFloat(s);
    if (isNaN(price) || price < 0.01 || price > 1) return NaN;
    return 1 / price;
  }

  function formatPolymarketPrice(decimalOdds) {
    if (decimalOdds <= 0 || !isFinite(decimalOdds)) return '0.00';
    var p = 1 / decimalOdds;
    if (p > 1 || p <= 0) return p.toFixed(2);
    var cents = Math.round(p * 100);
    if (cents <= 0 || cents >= 100) return p.toFixed(2);
    return '.' + (cents < 10 ? '0' : '') + cents;
  }

  function formatArbOdds(bookIdx, decimalOdds) {
    if (isPolyBook(bookIdx)) return '$' + formatPolymarketPrice(decimalOdds);
    if (decimalOdds >= 2) return '+' + Math.round((decimalOdds - 1) * 100);
    return String(Math.round(-100 / (decimalOdds - 1)));
  }

  function isPolyBook(bookIdx) {
    var name = getBookNames()[bookIdx] || '';
    return name.toLowerCase().indexOf('polymarket') !== -1 || name.toLowerCase().indexOf('poly') !== -1;
  }

  function bookToSite(bookName) {
    var p = String(bookName || '').trim().toLowerCase();
    if (p.indexOf('polymarket') !== -1) return 'Poly';
    if (p.indexOf('draft') !== -1 && p.indexOf('king') !== -1) return 'DK';
    if (p.indexOf('fan') !== -1 && p.indexOf('duel') !== -1) return 'FD';
    return bookName || '';
  }

  function formatMoney(n) {
    return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // --- Live implied probability badges ---

  oddsIds.forEach(function (id) {
    var badge = document.getElementById('imp-' + id);
    if (!badge || !el[id]) return;
    var bookIdx = parseInt(id.charAt(1), 10) - 1;
    el[id].addEventListener('input', function () {
      if (isPolyBook(bookIdx)) {
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

  function updateImpliedBadge(id) {
    var badge = document.getElementById('imp-' + id);
    if (!badge || !el[id]) return;
    var bookIdx = parseInt(id.charAt(1), 10) - 1;
    if (isPolyBook(bookIdx)) {
      var price = parseFloat(String(el[id].value).trim());
      badge.textContent = !isNaN(price) && price >= 0.01 && price <= 1 ? (price * 100).toFixed(1) + '% implied' : '';
    } else {
      var dec = parseOdds(el[id].value);
      badge.textContent = !isNaN(dec) && dec >= 1.01 ? (100 / dec).toFixed(1) + '% implied' : '';
    }
  }

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

  // --- Book helpers ---

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

  function getPropLabel() {
    return (el.propLabel && el.propLabel.value) || 'Enter Bet Here';
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

  function parseBookOdds(bookIdx) {
    var overEl = el['b' + (bookIdx + 1) + 'o'];
    var underEl = el['b' + (bookIdx + 1) + 'u'];
    var lineEl = el['line' + (bookIdx + 1)];
    if (!overEl || !underEl || !lineEl) return null;
    var overStr = overEl.value;
    var underStr = underEl.value;
    var lineStr = lineEl.value;
    var line = parseFloat(lineStr);
    if (isNaN(line)) return null;

    var overDec, underDec;
    if (isPolyBook(bookIdx)) {
      overDec = parsePolymarketPrice(overStr);
      underDec = parsePolymarketPrice(underStr);
    } else {
      overDec = parseOdds(overStr);
      underDec = parseOdds(underStr);
    }
    return { line: line, overDec: overDec, underDec: underDec };
  }

  function oddsOrPrice(bookIdx, bestOdds) {
    if (isPolyBook(bookIdx)) return 'price ' + formatPolymarketPrice(bestOdds);
    return 'odds ' + bestOdds.toFixed(2);
  }

  // --- Core middle bet calculation ---

  function run() {
    clearBestMarkers();
    lastArbResult = null;

    var book4Card = document.getElementById('book4Card');
    var numBooks = (book4Card && !book4Card.classList.contains('hidden')) ? 4 : 3;
    var books = getBookNames();
    var prop = getPropLabel();

    var parsed = [];
    for (var i = 0; i < numBooks; i++) {
      parsed.push(parseBookOdds(i));
    }

    function isValid(x) { return !isNaN(x) && x >= 1.01; }

    var bestSumP = Infinity;
    var bestOverBook = -1, bestUnderBook = -1;
    var bestOverOdds = NaN, bestUnderOdds = NaN;
    var bestOverLine = NaN, bestUnderLine = NaN;

    for (var a = 0; a < numBooks; a++) {
      for (var b = 0; b < numBooks; b++) {
        if (a === b) continue;
        if (!parsed[a] || !parsed[b]) continue;
        if (!isValid(parsed[a].overDec) || !isValid(parsed[b].underDec)) continue;
        if (parsed[a].line >= parsed[b].line) continue;
        var sp = 1 / parsed[a].overDec + 1 / parsed[b].underDec;
        if (sp < bestSumP) {
          bestSumP = sp;
          bestOverBook = a;
          bestUnderBook = b;
          bestOverOdds = parsed[a].overDec;
          bestUnderOdds = parsed[b].underDec;
          bestOverLine = parsed[a].line;
          bestUnderLine = parsed[b].line;
        }
      }
    }

    if (bestOverBook === -1) {
      var hasAnyOver = false, hasAnyUnder = false, hasDiffLines = false;
      for (var ci = 0; ci < numBooks; ci++) {
        if (parsed[ci] && isValid(parsed[ci].overDec)) hasAnyOver = true;
        if (parsed[ci] && isValid(parsed[ci].underDec)) hasAnyUnder = true;
      }
      for (var di = 0; di < numBooks && !hasDiffLines; di++) {
        for (var dj = di + 1; dj < numBooks && !hasDiffLines; dj++) {
          if (parsed[di] && parsed[dj] && parsed[di].line !== parsed[dj].line) hasDiffLines = true;
        }
      }
      if (!hasAnyOver || !hasAnyUnder) {
        showResult('<h3>Invalid input</h3><p>Enter a line, Over odds, and Under odds for at least two books.</p>', 'error');
      } else if (!hasDiffLines) {
        showResult('<h3>Arbitrage Not Found</h3><p>All books have the same line. A middle bet requires at least two different lines (e.g. O/U 4.5 on one book and O/U 5.5 on another).</p>', 'no-arb');
      } else {
        showResult('<h3>Arbitrage Not Found</h3><p>No valid middle bet pair found. The Over line must be lower than the Under line across different books.</p>', 'no-arb');
      }
      return;
    }

    // Highlight best inputs
    var overInputId = 'b' + (bestOverBook + 1) + 'o';
    var underInputId = 'b' + (bestUnderBook + 1) + 'u';
    if (el[overInputId]) el[overInputId].classList.add('best');
    if (el[underInputId]) el[underInputId].classList.add('best');

    var pOver = 1 / bestOverOdds;
    var pUnder = 1 / bestUnderOdds;
    var sumP = pOver + pUnder;

    var S = parseStake();
    var stakeOver = S * (pOver / sumP);
    var stakeUnder = S * (pUnder / sumP);

    var payoutOver = stakeOver * bestOverOdds;
    var payoutUnder = stakeUnder * bestUnderOdds;

    var scenarioA_profit = payoutUnder - S;
    var scenarioB_profit = (payoutOver + payoutUnder) - S;
    var scenarioC_profit = payoutOver - S;

    var arbScore = (sumP * 100).toFixed(2);

    if (sumP >= 1) {
      showResult(
        '<h3>Arbitrage Not Found</h3>' +
        '<p>Combined implied probability is <strong>' + arbScore + '%</strong> (needs to be below 100%).</p>' +
        '<p>Best Over: O ' + bestOverLine + ' @ ' + bookToSite(books[bestOverBook]) + ' (' + formatArbOdds(bestOverBook, bestOverOdds) + ')<br>' +
        'Best Under: U ' + bestUnderLine + ' @ ' + bookToSite(books[bestUnderBook]) + ' (' + formatArbOdds(bestUnderBook, bestUnderOdds) + ')</p>' +
        buildScenarioTable(bestOverLine, bestUnderLine, S, stakeOver, stakeUnder, scenarioA_profit, scenarioB_profit, scenarioC_profit),
        'no-arb'
      );
      return;
    }

    var guaranteedProfit = Math.min(scenarioA_profit, scenarioC_profit);
    var profitPct = ((guaranteedProfit / S) * 100).toFixed(2);

    showResult(
      '<h3>Middle Bet Found (' + arbScore + '%) — Place Following Bets</h3>' +
      '<div class="arb-bet">' +
        '<div class="arb-bet-header">Bet 1: $' + formatMoney(stakeOver) + ' on Over ' + bestOverLine + ' — ' + prop + ' on ' + bookToSite(books[bestOverBook]) + ' @ ' + formatArbOdds(bestOverBook, bestOverOdds) + '</div>' +
        '<div class="arb-bet-detail arb-bet-detail-line">Total Received: $' + formatMoney(payoutOver) + ' | Profit: $' + formatMoney(payoutOver - stakeOver) + '</div>' +
      '</div>' +
      '<div class="arb-bet">' +
        '<div class="arb-bet-header">Bet 2: $' + formatMoney(stakeUnder) + ' on Under ' + bestUnderLine + ' — ' + prop + ' on ' + bookToSite(books[bestUnderBook]) + ' @ ' + formatArbOdds(bestUnderBook, bestUnderOdds) + '</div>' +
        '<div class="arb-bet-detail arb-bet-detail-line">Total Received: $' + formatMoney(payoutUnder) + ' | Profit: $' + formatMoney(payoutUnder - stakeUnder) + '</div>' +
      '</div>' +
      buildScenarioTable(bestOverLine, bestUnderLine, S, stakeOver, stakeUnder, scenarioA_profit, scenarioB_profit, scenarioC_profit) +
      '<div class="summary">' +
        'Guaranteed Profit: <strong>$' + formatMoney(guaranteedProfit) + '</strong> &nbsp;|&nbsp; ' +
        'Middle Profit: <strong>$' + formatMoney(scenarioB_profit) + '</strong> &nbsp;|&nbsp; ' +
        'Total Bet: <strong>$' + formatMoney(S) + '</strong>' +
      '</div>',
      'profit'
    );

    lastArbResult = {
      date: getTodayMountainDateString(),
      prop: prop,
      books: books,
      bestOverBook: bestOverBook,
      bestUnderBook: bestUnderBook,
      bestOverOdds: bestOverOdds,
      bestUnderOdds: bestUnderOdds,
      bestOverLine: bestOverLine,
      bestUnderLine: bestUnderLine,
      oddsOrPriceOver: oddsOrPrice(bestOverBook, bestOverOdds),
      oddsOrPriceUnder: oddsOrPrice(bestUnderBook, bestUnderOdds),
      stakeOver: stakeOver,
      stakeUnder: stakeUnder,
      payoutOver: payoutOver,
      payoutUnder: payoutUnder,
      guaranteedProfit: guaranteedProfit,
      middleBonus: scenarioB_profit,
      profitPct: profitPct,
      totalStake: S
    };
  }

  function buildScenarioTable(overLine, underLine, total, stakeOver, stakeUnder, profitA, profitB, profitC) {
    var midLow = overLine + 0.5;
    var midHigh = underLine - 0.5;
    var midLabel;
    if (midLow === midHigh) {
      midLabel = 'Exactly ' + midLow;
    } else {
      midLabel = midLow + ' – ' + midHigh;
    }

    var payoutOver = profitC + total;
    var payoutUnder = profitA + total;

    function fmtCell(val) {
      if (val >= 0) return '<td>+$' + formatMoney(val) + '</td>';
      return '<td class="s2-cell-amount-neg">−$' + formatMoney(Math.abs(val)) + '</td>';
    }
    function fmtProfit(val, highlight) {
      var cls = highlight ? ' s2-middle-profit' : '';
      if (val >= 0) return '<td class="' + (cls ? cls.trim() : '') + '">+$' + formatMoney(val) + '</td>';
      return '<td class="s2-cell-neg' + cls + '">−$' + formatMoney(Math.abs(val)) + '</td>';
    }

    return '<table class="s2-scenario-table">' +
      '<thead><tr>' +
        '<th>Scenario</th><th>Result</th><th>Over Bet</th><th>Under Bet</th><th>Net Profit</th>' +
      '</tr></thead>' +
      '<tbody>' +
        '<tr class="s2-edge-row">' +
          '<td>&le; ' + overLine + '</td>' +
          '<td>Under wins</td>' +
          fmtCell(-stakeOver) +
          fmtCell(payoutUnder - stakeUnder) +
          fmtProfit(profitA) +
        '</tr>' +
        '<tr class="s2-middle-row">' +
          '<td>' + midLabel + '</td>' +
          '<td>BOTH win</td>' +
          fmtCell(payoutOver - stakeOver) +
          fmtCell(payoutUnder - stakeUnder) +
          fmtProfit(profitB, true) +
        '</tr>' +
        '<tr class="s2-edge-row">' +
          '<td>&ge; ' + underLine + '</td>' +
          '<td>Over wins</td>' +
          fmtCell(payoutOver - stakeOver) +
          fmtCell(-stakeUnder) +
          fmtProfit(profitC) +
        '</tr>' +
      '</tbody></table>';
  }

  // --- Storage keys (separate from Strategy 1) ---

  var BET_LOG_KEY = 'middleBetLog';
  var UI_STATE_KEY = 'middleBetUIState';

  function getTodayMountainDateString() {
    var s = new Date().toLocaleDateString('en-US', { timeZone: 'America/Denver' });
    var parts = s.split('/');
    if (parts.length !== 3) return s;
    return parts[0] + '-' + parts[1] + '-' + parts[2];
  }

  function updateLogDateDisplay() {
    var dateEl = document.getElementById('logDateDisplay');
    if (dateEl) dateEl.textContent = getTodayMountainDateString();
  }

  function formatDateToMDY(str) {
    if (!str || !String(str).trim()) return '';
    var s = String(str).trim();
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return (d.getMonth() + 1) + '-' + d.getDate() + '-' + d.getFullYear();
  }

  function formatDateToSlashMDY(str) {
    if (!str || !String(str).trim()) return '';
    var d = new Date(String(str).trim());
    if (isNaN(d.getTime())) return str;
    return (d.getMonth() + 1) + '/' + d.getDate() + '/' + String(d.getFullYear()).slice(-2);
  }

  function getLogFromStorage() {
    try {
      return JSON.parse(localStorage.getItem(BET_LOG_KEY) || '[]');
    } catch (e) {
      return [];
    }
  }

  function parseLogNum(val) {
    var n = parseFloat(String(val != null ? val : '').replace(/[$,%]/g, ''));
    return isNaN(n) ? 0 : n;
  }

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

  function getDateKey(dateStr) {
    if (!dateStr || !String(dateStr).trim()) return '';
    var d = new Date(String(dateStr).trim());
    if (isNaN(d.getTime())) return '';
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  function getProfitForOutcome(rowA, outcome) {
    if (!rowA || !outcome) return 0;
    var o = String(outcome).toLowerCase();
    if (rowA.profitOver != null || rowA.profitUnder != null || rowA.profitExactly != null) {
      if (o === 'over') return parseLogNum(rowA.profitOver);
      if (o === 'under') return parseLogNum(rowA.profitUnder);
      if (o === 'exactly') return parseLogNum(rowA.profitExactly);
    }
    return parseLogNum(rowA.Profit);
  }

  function getCumulativeProfitData() {
    var log = getLogFromStorage();
    var byDate = {};
    for (var i = 0; i < log.length; i += 2) {
      var rowA = log[i];
      var rowB = log[i + 1];
      var outcomeSelected = rowA && rowA.outcomeSelected ? String(rowA.outcomeSelected).toLowerCase() : null;
      if (!outcomeSelected || (outcomeSelected !== 'over' && outcomeSelected !== 'under' && outcomeSelected !== 'exactly')) continue;
      var dateStr = rowA && rowA.Date ? String(rowA.Date).trim() : '';
      var profit = getProfitForOutcome(rowA, outcomeSelected);
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
    var w = 800, h = 200;
    var pad = { top: 10, right: 0, bottom: 32, left: 0 };
    var yAxisWidth = 52;
    var plotLeft = yAxisWidth;
    var plotRight = w;
    var plotWidth = plotRight - plotLeft;
    var plotH = h - pad.top - pad.bottom;
    var minCum = 0, maxCum = 0;
    for (var i = 0; i < data.length; i++) {
      if (data[i].cumulative < minCum) minCum = data[i].cumulative;
      if (data[i].cumulative > maxCum) maxCum = data[i].cumulative;
    }
    var yMin = minCum >= 0 ? 0 : minCum;
    var yMax = maxCum <= 0 ? 0 : maxCum;
    var range = yMax - yMin;
    if (range === 0) range = 1;
    yMin -= range * 0.03;
    yMax += range * 0.03;
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
      for (var t = 0; t <= 5; t++) yTickVals.push(yMin + (t / 5) * yRange);
    }
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'none');
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
        (function (idx2) {
          rect.addEventListener('mouseenter', function (e) {
            var run = data[idx2];
            var runPct = run.runningAmountBet > 0 ? ((run.cumulative / run.runningAmountBet) * 100).toFixed(2) : '0.00';
            var tip = document.getElementById('profitChartTooltip');
            if (!tip) {
              tip = document.createElement('div');
              tip.id = 'profitChartTooltip';
              tip.className = 'profit-chart-tooltip';
              tip.style.display = 'none';
              document.body.appendChild(tip);
            }
            tip.innerHTML =
              '<div class="tooltip-date">' + (formatDateToMDY(run.dateStr) || run.dateStr) + '</div>' +
              '<div class="tooltip-row">% Profit: ' + runPct + '%</div>' +
              '<div class="tooltip-row">Total Profit: $' + formatMoney(run.cumulative) + '</div>' +
              '<div class="tooltip-row">Total Amount Bet: $' + formatMoney(run.runningAmountBet) + '</div>';
            tip.style.left = (e.clientX + 10) + 'px';
            tip.style.top = (e.clientY + 10) + 'px';
            tip.style.display = 'block';
          });
          rect.addEventListener('mouseleave', function () {
            var tip = document.getElementById('profitChartTooltip');
            if (tip) tip.style.display = 'none';
          });
        })(bi);
        svg.appendChild(rect);
      }
    } else {
      function catmullRomToBezier(p0, p1, p2, p3) {
        return 'C' + (p1.x + (p2.x - p0.x) / 6) + ',' + (p1.y + (p2.y - p0.y) / 6) +
          ' ' + (p2.x - (p3.x - p1.x) / 6) + ',' + (p2.y - (p3.y - p1.y) / 6) +
          ' ' + p2.x + ',' + p2.y;
      }
      var smoothPath = 'M' + pts[0].x + ',' + pts[0].y;
      for (var k = 1; k < pts.length; k++) {
        smoothPath += catmullRomToBezier(pts[k - 2] || pts[0], pts[k - 1], pts[k], pts[k + 1] || pts[k]);
      }
      var area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      area.setAttribute('d', smoothPath + 'L' + pts[pts.length - 1].x + ',' + baseline + 'L' + pts[0].x + ',' + baseline + 'Z');
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
      (function (idx3) {
        circle.addEventListener('mouseenter', function (e) {
          var run = data[idx3];
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
        circle.addEventListener('mouseleave', function () { tooltipEl.style.display = 'none'; });
      })(hi);
      hoverGroup.appendChild(circle);
    }
    svg.appendChild(hoverGroup);
    for (var ti = 0; ti < yTickVals.length; ti++) {
      var label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', 8);
      label.setAttribute('y', yScale(yTickVals[ti]) + 4);
      label.setAttribute('text-anchor', 'start');
      label.setAttribute('class', 'chart-axis-text');
      label.textContent = '$' + formatMoney(yTickVals[ti]);
      svg.appendChild(label);
    }
    var xAxisY = h - 10;
    var dateIndices = [];
    var barCenterX = null;
    if (useBarChart) {
      for (var di = 0; di < data.length; di++) dateIndices.push(di);
      var unit2 = plotWidth / 10;
      var totalBarBlock2 = data.length * unit2 + (data.length - 1) * unit2;
      var startX2 = plotLeft + (plotWidth - totalBarBlock2) / 2;
      barCenterX = function (i) { return startX2 + i * (2 * unit2) + unit2 / 2; };
    } else {
      var dateStep = Math.max(1, Math.floor(data.length / 6));
      for (var dd = 0; dd < data.length; dd += dateStep) dateIndices.push(dd);
      if (data.length > 0 && dateIndices.indexOf(data.length - 1) === -1) dateIndices.push(data.length - 1);
    }
    for (var dii = 0; dii < dateIndices.length; dii++) {
      var dIdx = dateIndices[dii];
      var dateLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dateLabel.setAttribute('x', barCenterX ? barCenterX(dIdx) : xScale(dIdx));
      dateLabel.setAttribute('y', xAxisY);
      dateLabel.setAttribute('text-anchor', 'middle');
      dateLabel.setAttribute('class', 'chart-axis-text');
      dateLabel.textContent = formatDateToSlashMDY(data[dIdx].dateStr) || data[dIdx].dateStr;
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
    for (var i = 0; i < log.length; i += 2) {
      var rowA = log[i];
      var rowB = log[i + 1];
      var outcomeSelected = rowA && rowA.outcomeSelected ? String(rowA.outcomeSelected).toLowerCase() : null;
      if (!outcomeSelected || (outcomeSelected !== 'over' && outcomeSelected !== 'under' && outcomeSelected !== 'exactly')) continue;
      var amtA = rowA ? parseLogNum(rowA['Amount Bet']) : 0;
      var amtB = rowB ? parseLogNum(rowB['Amount Bet']) : 0;
      totalAmountBet += amtA + amtB;
      totalProfit += getProfitForOutcome(rowA, outcomeSelected);
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
    [3, 10, 32, 12, 32, 12, 16, 8, 10].forEach(function (w) {
      var col = document.createElement('col');
      col.style.width = w + 'ch';
      colgroup.appendChild(col);
    });
    table.appendChild(colgroup);
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['', 'Date', 'Bet 1', 'Bet 1 amt', 'Bet 2', 'Bet 2 amt', 'Profit', 'Arb %', 'Outcome'].forEach(function (h) {
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
      var line1 = String(rowA.Outcome || '').replace(/^Over\s+/i, '').trim();
      var odds1 = formatLogOdds(rowA['Odds or Price']);
      var bet1 = (rowA.Game || 'Enter Bet Here') + ' O ' + line1 + (odds1 ? ' (' + odds1 + ')' : '') + ' @ ' + platformToSite(rowA.Platform);
      var bet1Amt = rowA['Amount Bet'] != null ? '$' + rowA['Amount Bet'] : '';
      var line2 = rowB ? String(rowB.Outcome || '').replace(/^Under\s+/i, '').trim() : '';
      var odds2 = rowB ? formatLogOdds(rowB['Odds or Price']) : '';
      var bet2 = rowB ? (rowB.Game || 'Enter Bet Here') + ' U ' + line2 + (odds2 ? ' (' + odds2 + ')' : '') + ' @ ' + platformToSite(rowB.Platform) : '';
      var bet2Amt = rowB && rowB['Amount Bet'] != null ? '$' + rowB['Amount Bet'] : '';
      var totalAmt = parseLogNum(rowA['Amount Bet']) + (rowB ? parseLogNum(rowB['Amount Bet']) : 0);
      var outcomeSelected = rowA.outcomeSelected ? String(rowA.outcomeSelected).toLowerCase() : '';
      var profitNum = outcomeSelected ? getProfitForOutcome(rowA, outcomeSelected) : 0;
      var profitPctStr = totalAmt > 0 && outcomeSelected ? (profitNum / totalAmt * 100).toFixed(2) : '';
      var profit = outcomeSelected ? '$' + formatMoney(profitNum) + (profitPctStr !== '' ? ' (' + profitPctStr + '%)' : '') : '—';
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
        try { localStorage.setItem(BET_LOG_KEY, JSON.stringify(logData)); } catch (e) {}
        renderCalcLog();
      });
      deleteCell.appendChild(deleteBtn);
      tr.appendChild(deleteCell);
      [
        { text: formatDateToMDY(rowA.Date) || '', align: 'center' },
        { text: bet1, align: 'left' },
        { text: bet1Amt, align: 'center' },
        { text: bet2, align: 'left' },
        { text: bet2Amt, align: 'center' },
        { text: profit, align: 'center' },
        { text: arbPctStr === '—' ? arbPctStr : arbPctStr + '%', align: 'center' }
      ].forEach(function (item) {
        var td = document.createElement('td');
        td.className = 'calc-log-td calc-log-td--' + item.align;
        td.style.textAlign = item.align;
        td.textContent = item.text;
        tr.appendChild(td);
      });
      var outcomeCell = document.createElement('td');
      outcomeCell.className = 'calc-log-td calc-log-td--center';
      var select = document.createElement('select');
      select.className = 's2-outcome-select';
      select.dataset.startIndex = String(i);
      select.setAttribute('aria-label', 'Result outcome');
      var opts = [
        { value: '', text: '—' },
        { value: 'over', text: 'Over' },
        { value: 'exactly', text: 'Exactly' },
        { value: 'under', text: 'Under' }
      ];
      opts.forEach(function (opt) {
        var option = document.createElement('option');
        option.value = opt.value;
        option.textContent = opt.text;
        if ((rowA.outcomeSelected || '').toLowerCase() === opt.value) option.selected = true;
        select.appendChild(option);
      });
      outcomeCell.appendChild(select);
      tr.appendChild(outcomeCell);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    tableWrap.innerHTML = '';
    tableWrap.appendChild(table);
  }

  function appendArbToLog(arb) {
    try {
      var log = getLogFromStorage();
      var profitUnder = arb.payoutUnder - arb.totalStake;
      var profitOver = arb.payoutOver - arb.totalStake;
      var rowA = {
        Date: arb.date,
        Game: arb.prop,
        Outcome: 'Over ' + arb.bestOverLine,
        Platform: arb.books[arb.bestOverBook],
        'Odds or Price': arb.oddsOrPriceOver,
        'Amount Bet': formatMoney(arb.stakeOver),
        Payout: formatMoney(arb.payoutOver),
        Profit: '',
        profitOver: profitOver,
        profitUnder: profitUnder,
        profitExactly: arb.middleBonus,
        outcomeSelected: null,
        'Profit Pct': '',
        Notes: ''
      };
      var rowB = {
        Date: arb.date,
        Game: arb.prop,
        Outcome: 'Under ' + arb.bestUnderLine,
        Platform: arb.books[arb.bestUnderBook],
        'Odds or Price': arb.oddsOrPriceUnder,
        'Amount Bet': formatMoney(arb.stakeUnder),
        Payout: formatMoney(arb.payoutUnder),
        Profit: '',
        Notes: ''
      };
      log.push(rowA);
      log.push(rowB);
      localStorage.setItem(BET_LOG_KEY, JSON.stringify(log));
      renderCalcLog();
    } catch (e) {}
  }

  renderCalcLog();

  // --- Save / Restore ---

  function saveLogOutcomes() {
    var log = getLogFromStorage();
    var selects = document.querySelectorAll('.s2-outcome-select');
    for (var s = 0; s < selects.length; s++) {
      var sel = selects[s];
      var start = parseInt(sel.dataset.startIndex, 10);
      if (isNaN(start) || start < 0 || start >= log.length) continue;
      var rowA = log[start];
      var val = (sel.value || '').toLowerCase();
      if (val !== 'over' && val !== 'under' && val !== 'exactly') val = null;
      rowA.outcomeSelected = val || null;
      if (val) {
        var p = getProfitForOutcome(rowA, val);
        rowA.Profit = formatMoney(p);
      } else {
        rowA.Profit = '';
      }
    }
    try { localStorage.setItem(BET_LOG_KEY, JSON.stringify(log)); } catch (e) {}
    renderCalcLog();
  }

  function saveUIState() {
    saveLogOutcomes();
    var profitChartWrap = document.getElementById('profitChartWrap');
    var calcKpiSection = document.getElementById('calcKpiSection');
    var calculatorSection = document.getElementById('calculatorSection');
    var calcLogSection = document.getElementById('calcLogSection');
    var state = {
      propLabel: el.propLabel && el.propLabel.value,
      name1: el.name1 && el.name1.value,
      name2: el.name2 && el.name2.value,
      name3: el.name3 && el.name3.value,
      line1: el.line1 && el.line1.value,
      line2: el.line2 && el.line2.value,
      line3: el.line3 && el.line3.value,
      b1o: el.b1o && el.b1o.value,
      b1u: el.b1u && el.b1u.value,
      b2o: el.b2o && el.b2o.value,
      b2u: el.b2u && el.b2u.value,
      b3o: el.b3o && el.b3o.value,
      b3u: el.b3u && el.b3u.value,
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
      line4: el.line4 && el.line4.value,
      b4o: el.b4o && el.b4o.value,
      b4u: el.b4u && el.b4u.value
    };
    try { localStorage.setItem(UI_STATE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function restoreUIState() {
    try {
      var raw = localStorage.getItem(UI_STATE_KEY);
      if (!raw) return;
      var state = JSON.parse(raw);
      if (el.propLabel && state.propLabel != null) el.propLabel.value = state.propLabel;
      if (state.name1 != null && el.name1) el.name1.value = state.name1;
      if (state.name2 != null && el.name2) el.name2.value = state.name2;
      if (state.name3 != null && el.name3) el.name3.value = state.name3;
      if (state.line1 != null && el.line1) el.line1.value = state.line1;
      if (state.line2 != null && el.line2) el.line2.value = state.line2;
      if (state.line3 != null && el.line3) el.line3.value = state.line3;
      if (state.b1o != null && el.b1o) el.b1o.value = state.b1o;
      if (state.b1u != null && el.b1u) el.b1u.value = state.b1u;
      if (state.b2o != null && el.b2o) el.b2o.value = state.b2o;
      if (state.b2u != null && el.b2u) el.b2u.value = state.b2u;
      if (state.b3o != null && el.b3o) el.b3o.value = state.b3o;
      if (state.b3u != null && el.b3u) el.b3u.value = state.b3u;
      if (state.name4 != null && el.name4) el.name4.value = state.name4;
      if (state.line4 != null && el.line4) el.line4.value = state.line4;
      if (state.b4o != null && el.b4o) el.b4o.value = state.b4o;
      if (state.b4u != null && el.b4u) el.b4u.value = state.b4u;
      if (el.stake) el.stake.value = (state.stake && state.stake.replace(/,/g, '') !== '' && state.stake !== '1,000' ? state.stake : '');

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

      oddsIds.forEach(function (id) { updateImpliedBadge(id); });

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
        if (state.calculatorHidden) calculatorSection.classList.add('hidden');
        else calculatorSection.classList.remove('hidden');
      }
      if (calcLogSection && state.logHidden != null) {
        if (state.logHidden) calcLogSection.classList.add('hidden');
        else calcLogSection.classList.remove('hidden');
      }
    } catch (e) {}
  }

  restoreUIState();

  // --- Button event listeners ---

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
      if (el[id]) el[id].value = '';
      var badge = document.getElementById('imp-' + id);
      if (badge) badge.textContent = '';
    });
    lineIds.forEach(function (id) { if (el[id]) el[id].value = ''; });
    if (el.stake) el.stake.value = '';
    if (el.propLabel) el.propLabel.value = '';
    if (el.name1) el.name1.value = 'Draft Kings';
    if (el.name2) el.name2.value = 'Fan Duel';
    if (el.name3) el.name3.value = 'Polymarket';
    resultEl.className = 'result hidden';
    resultEl.innerHTML = '';
    lastArbResult = null;
    exampleLoaded = false;
  });

  // --- Log current arb ---

  if (betBtn) {
    betBtn.addEventListener('click', function () {
      if (lastArbResult) {
        appendArbToLog(lastArbResult);
        lastArbResult = null;
      }
    });
  }

  // --- Load Example: Keyonte George Assists ---

  if (loadExampleBtn) {
    loadExampleBtn.addEventListener('click', function () {
      if (exampleLoaded) {
        clearBestMarkers();
        oddsIds.forEach(function (id) {
          if (el[id]) el[id].value = '';
          var badge = document.getElementById('imp-' + id);
          if (badge) badge.textContent = '';
        });
        lineIds.forEach(function (id) { if (el[id]) el[id].value = ''; });
        if (el.stake) el.stake.value = '';
        if (el.propLabel) el.propLabel.value = '';
        if (el.name1) el.name1.value = 'Draft Kings';
        if (el.name2) el.name2.value = 'Fan Duel';
        if (el.name3) el.name3.value = 'Polymarket';
        resultEl.className = 'result hidden';
        resultEl.innerHTML = '';
        lastArbResult = null;
        exampleLoaded = false;
        renderCalcLog();
        return;
      }

      clearBestMarkers();

      if (el.propLabel) el.propLabel.value = 'Keyonte George Assists';

      // Book 1: DK
      if (el.name1) el.name1.value = 'Draft Kings';
      if (el.line1) el.line1.value = '4.5';
      if (el.b1o) el.b1o.value = '-120';
      if (el.b1u) el.b1u.value = '-110';

      // Book 2: FD
      if (el.name2) el.name2.value = 'Fan Duel';
      if (el.line2) el.line2.value = '4.5';
      if (el.b2o) el.b2o.value = '-115';
      if (el.b2u) el.b2u.value = '-108';

      // Book 3: Poly
      if (el.name3) el.name3.value = 'Polymarket';
      if (el.line3) el.line3.value = '5.5';
      if (el.b3o) el.b3o.value = '.27';
      if (el.b3u) el.b3u.value = '.45';

      // Book 4: BetMGM — show the 4th book
      var b4Card = document.getElementById('book4Card');
      var addBtn = document.getElementById('addBookBtn');
      var bkContainer = document.getElementById('booksContainer');
      if (b4Card && b4Card.classList.contains('hidden')) {
        b4Card.classList.remove('hidden');
        if (bkContainer) bkContainer.classList.add('four-books');
        if (addBtn) {
          addBtn.textContent = '- Book';
          addBtn.setAttribute('aria-label', 'Remove fourth book');
        }
      }
      if (el.name4) el.name4.value = 'BetMGM';
      if (el.line4) el.line4.value = '4.5';
      if (el.b4o) el.b4o.value = '-130';
      if (el.b4u) el.b4u.value = '-105';

      if (el.stake) el.stake.value = '1,000';

      oddsIds.forEach(updateImpliedBadge);
      run();
      exampleLoaded = true;
    });
  }
})();
