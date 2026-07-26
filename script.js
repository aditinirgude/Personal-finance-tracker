/**
 * script.js — Personal Finance Tracker
 * Phase 2: Full Transaction Management
 *   – In-memory CRUD (Add / Edit / Delete)
 *   – Client-side form validation
 *   – Live search + multi-dimensional filtering
 *   – Dashboard & monthly quick-stats calculations
 *   – Spending insights (top categories, monthly chart, health score)
 *   – Pagination (Load More)
 *   – Currency selector
 * Phase 3: localStorage persistence, real toast notifications, theme/settings persistence
 * Phase 4: Accessibility (focus trap, ARIA focus mgmt), reduced-motion, cross-browser polish
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   1. STATE & CONFIGURATION
   ═══════════════════════════════════════════════════════════════════════════ */

/** In-memory transaction store */
let transactions = [];

/** ID of the transaction currently being edited; null when adding */
let editingId = null;

/** Pending deletion ID (set before showing confirm modal) */
let pendingDeleteId = null;

/** Currency symbol shown throughout the UI */
let currencySymbol = '₹';

/** Number of transaction rows currently visible (pagination) */
let visibleCount = 10;

/** Rows per page for "Load More" */
const PAGE_SIZE = 10;

/** Active filter state */
const activeFilters = {
  search: '',
  category: '',
  type: 'all',  // 'all' | 'income' | 'expense'
  dateFrom: '',
  dateTo: '',
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. UTILITY & CURRENCY HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/** 12 hours cache expiration duration (in ms) */
const CACHE_DURATION_MS = 12 * 60 * 60 * 1000;

/** Supported currencies metadata: Symbol to ISO code & locale mapping */
const CURRENCY_MAP = {
  '₹':    { code: 'INR', locale: 'en-IN' },
  '$':    { code: 'USD', locale: 'en-US' },
  '€':    { code: 'EUR', locale: 'de-DE' },
  '£':    { code: 'GBP', locale: 'en-GB' },
  '¥':    { code: 'JPY', locale: 'ja-JP' },
  'د.إ':  { code: 'AED', locale: 'ar-AE' },
};

/** Safety fallback rates if network API is un-reachable and no cache exists */
const DEFAULT_RATES = {
  INR: 1,
  USD: 0.0115,
  EUR: 0.0098,
  GBP: 0.0084,
  JPY: 1.78,
  AED: 0.0422,
};

/** In-memory active live exchange rates map (base currency: INR) */
let liveRates = { ...DEFAULT_RATES };

/**
 * Initialize exchange rates: reads from 12h LocalStorage cache or fetches from free API.
 */
async function initExchangeRates() {
  const cachedRates = getCachedExchangeRates();
  const timestamp = getRatesTimestamp();
  const now = Date.now();

  if (cachedRates && timestamp && (now - timestamp < CACHE_DURATION_MS)) {
    liveRates = { ...DEFAULT_RATES, ...cachedRates };
    return;
  }

  // Fetch fresh rates from free Open Exchange Rates API
  await fetchLiveExchangeRates();
}

/**
 * Fetch latest live exchange rates from public CORS-enabled API with timeout & fallback handling.
 */
async function fetchLiveExchangeRates() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/INR', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const data = await res.json();
    if (data && data.result === 'success' && data.rates) {
      liveRates = {
        INR: 1,
        USD: data.rates.USD || DEFAULT_RATES.USD,
        EUR: data.rates.EUR || DEFAULT_RATES.EUR,
        GBP: data.rates.GBP || DEFAULT_RATES.GBP,
        JPY: data.rates.JPY || DEFAULT_RATES.JPY,
        AED: data.rates.AED || DEFAULT_RATES.AED,
      };

      // Persist to LocalStorage cache with timestamp
      saveCachedExchangeRates(liveRates);
      saveRatesTimestamp(Date.now());
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[rates] Network/API error fetching live rates:', err);

    // Fallback strategy: check if any prior cache exists
    const cachedRates = getCachedExchangeRates();
    if (cachedRates) {
      liveRates = { ...DEFAULT_RATES, ...cachedRates };
    } else {
      liveRates = { ...DEFAULT_RATES };
      showToast('Live exchange rates offline. Using default currency rates.', 'info');
    }
  }
}

/**
 * Get current exchange rate for active currency symbol.
 * @returns {number}
 */
function getExchangeRate() {
  const info = CURRENCY_MAP[currencySymbol] || CURRENCY_MAP['₹'];
  return liveRates[info.code] || DEFAULT_RATES[info.code] || 1;
}

/**
 * Convert an amount from base currency (INR) to currently selected display currency.
 * @param {number} inrAmount
 * @returns {number}
 */
function convertAmount(inrAmount) {
  return inrAmount * getExchangeRate();
}

/**
 * Convert an amount entered in active display currency back to base currency (INR).
 * @param {number} inputAmount
 * @returns {number}
 */
function toBaseINR(inputAmount) {
  const rate = getExchangeRate();
  return rate > 0 ? inputAmount / rate : inputAmount;
}

/**
 * Generate a unique ID for each transaction.
 * Uses crypto.randomUUID() if available, otherwise falls back to Date.now().
 */
function generateId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format an internal INR base number as a converted currency string.
 * Always uses dot (.) as the decimal separator and comma (,) as the thousands separator,
 * regardless of browser or OS locale settings.
 * @param {number} inrAmount - Amount in base currency (INR)
 * @returns {string} e.g. "€216.65", "$11.50", "¥1,500", "₹1,23,456.78", "د.إ42.20"
 */
function formatCurrency(inrAmount) {
  const converted = Math.abs(convertAmount(inrAmount));
  const info = CURRENCY_MAP[currencySymbol] || CURRENCY_MAP['₹'];
  const decimals = info.code === 'JPY' ? 0 : 2;

  // Build fixed-decimal string (always uses dot)
  const fixed = converted.toFixed(decimals);

  // Split into integer and decimal parts
  const [intPart, decPart] = fixed.split('.');

  // Add thousands separators (INR style: 2,2,2 grouping for lakh/crore; others: standard 3)
  let formattedInt;
  if (info.code === 'INR') {
    // Indian numbering: last 3 digits, then groups of 2
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, intPart.length - 3);
    formattedInt = rest
      ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree;
  } else {
    formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  const result = decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt;
  return `${currencySymbol}${result}`;
}

/**
 * Format an ISO date string ("YYYY-MM-DD") to a human-readable string.
 * @param {string} isoDate
 * @returns {string}  e.g. "25 Jul 2026"
 */
function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

/**
 * Return today's date as an ISO string ("YYYY-MM-DD").
 */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Show a toast notification with auto-dismiss.
 * Injects a .toast element into #toast-container and animates it in/out.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='success']
 * @param {number} [duration=3500]  ms before auto-dismiss
 */
function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
    <span class="toast-message">${_escapeHtml(String(message))}</span>
    <button class="toast-close" type="button" aria-label="Dismiss notification">✕</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => _dismissToast(toast));
  container.appendChild(toast);

  // Force reflow then trigger CSS enter animation
  void toast.offsetWidth;
  toast.classList.add('toast--visible');

  // Auto-dismiss after duration
  toast._dismissTimer = setTimeout(() => _dismissToast(toast), duration);
}

/**
 * Animate a toast out and remove it from the DOM.
 * @param {HTMLElement} toast
 */
function _dismissToast(toast) {
  if (!toast || toast._dismissed) return;
  toast._dismissed = true;
  clearTimeout(toast._dismissTimer);
  toast.classList.remove('toast--visible');
  toast.classList.add('toast--hiding');
  // Remove after animation; fallback timeout guards against missing animationend
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  setTimeout(() => toast.isConnected && toast.remove(), 600);
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. DASHBOARD UPDATER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Recalculate and re-render all dashboard summary cards.
 */
function updateDashboard() {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalInvestment = transactions
    .filter(t => t.type === 'investment')
    .reduce((sum, t) => sum + t.amount, 0);

  // Available Cash Balance = Income - Expense - Investment
  const balance = totalIncome - totalExpense - totalInvestment;

  // Total Saved = Income - Expense (Investment is saved money, not an expense)
  const totalSaved = Math.max(0, totalIncome - totalExpense);

  // Savings Rate = Total Saved / Income
  const savingsRate = totalIncome > 0
    ? Math.min(100, Math.max(0, (totalSaved / totalIncome) * 100))
    : 0;

  // Investment Percentage = Total Investment / Income
  const investmentPct = totalIncome > 0
    ? Math.min(100, Math.max(0, (totalInvestment / totalIncome) * 100))
    : 0;

  // Inject values into DOM
  const el = id => document.getElementById(id);

  if (el('total-balance')) el('total-balance').textContent = (balance < 0 ? '−' : '') + formatCurrency(balance);
  if (el('total-income')) el('total-income').textContent = formatCurrency(totalIncome);
  if (el('total-expense')) el('total-expense').textContent = formatCurrency(totalExpense);
  if (el('total-investment')) el('total-investment').textContent = formatCurrency(totalInvestment);
  if (el('total-savings')) el('total-savings').textContent = `${savingsRate.toFixed(1)}%`;
  if (el('investment-pct')) el('investment-pct').textContent = `${investmentPct.toFixed(1)}% of Income`;

  // Savings bar fill
  const barFill = el('savings-bar-fill');
  if (barFill) barFill.style.width = `${savingsRate}%`;

  // Balance card colour class
  const balCard = el('card-balance');
  if (balCard) {
    balCard.classList.toggle('card--balance-negative', balance < 0);
  }

  // Trend indicators
  _setTrend('balance-trend', balance, '+0%');
  _setTrend('income-trend', totalIncome, `+${savingsRate.toFixed(0)}%`);
  _setTrend('expense-trend', -totalExpense, '');
  _setTrend('investment-trend', totalInvestment, `${investmentPct.toFixed(0)}%`);
}

/**
 * Helper: update a trend badge element.
 * @param {string} elemId
 * @param {number} value   — positive = up, negative = down
 * @param {string} label
 */
function _setTrend(elemId, value, label) {
  const el = document.getElementById(elemId);
  if (!el) return;
  const arrow = el.querySelector('.trend-arrow');
  const text = el.querySelector('.trend-text');
  if (arrow) {
    arrow.textContent = value >= 0 ? '↑' : '↓';
    arrow.className = `trend-arrow ${value >= 0 ? 'trend--up' : 'trend--down'}`;
  }
  if (text && label) text.textContent = label;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. MONTHLY QUICK-STATS UPDATER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Recalculate this-month totals and update the Monthly Summary sidebar card.
 */
function updateQuickStats() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const thisMonth = transactions.filter(t => {
    const d = new Date(t.date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const mIncome = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const mExpense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const mInvestment = thisMonth.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);
  const mNet = mIncome - mExpense - mInvestment;

  const el = id => document.getElementById(id);

  const monthLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (el('qs-month')) el('qs-month').textContent = monthLabel;
  if (el('qs-month-income')) el('qs-month-income').textContent = formatCurrency(mIncome);
  if (el('qs-month-expense')) el('qs-month-expense').textContent = formatCurrency(mExpense);
  if (el('qs-month-investment')) el('qs-month-investment').textContent = formatCurrency(mInvestment);
  if (el('qs-count')) el('qs-count').textContent = thisMonth.length;

  const netEl = el('qs-month-net');
  if (netEl) {
    netEl.textContent = (mNet < 0 ? '−' : '') + formatCurrency(mNet);
    netEl.className = `qs-value ${mNet >= 0 ? 'text-income' : 'text-expense'}`;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. SPENDING INSIGHTS UPDATER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Render the Statistics section: top categories, monthly chart, health score.
 */
function updateStats() {
  _renderTopCategories();
  _renderMonthlyChart();
  _renderHealthScore();
}

/** Render the top-5 expense categories bar list */
function _renderTopCategories() {
  const listEl = document.getElementById('top-categories-list');
  if (!listEl) return;

  // Group expenses & investments by category
  const categoryTotals = {};
  transactions
    .filter(t => t.type === 'expense' || t.type === 'investment')
    .forEach(t => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

  const sorted = Object.entries(categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  if (sorted.length === 0) {
    listEl.innerHTML = `
      <li class="top-category-item placeholder-item" aria-hidden="true">
        <span class="tc-label">No expense or investment data yet</span>
        <div class="tc-bar-wrap"><div class="tc-bar" style="width:0%"></div></div>
        <span class="tc-amount">—</span>
      </li>`;
    return;
  }

  const maxVal = sorted[0][1];
  listEl.innerHTML = sorted.map(([cat, total]) => {
    const pct = maxVal > 0 ? (total / maxVal) * 100 : 0;
    return `
      <li class="top-category-item">
        <span class="tc-label">${_categoryEmoji(cat)} ${cat}</span>
        <div class="tc-bar-wrap">
          <div class="tc-bar" style="width:${pct.toFixed(1)}%"></div>
        </div>
        <span class="tc-amount">${formatCurrency(total)}</span>
      </li>`;
  }).join('');
}

/** Render the last-6-months income vs expense vs investment bar chart */
function _renderMonthlyChart() {
  const chartEl = document.getElementById('monthly-chart');
  if (!chartEl) return;

  // Build array of last 6 months (most recent last)
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: d.toLocaleDateString('en-IN', { month: 'short' }),
      income: 0,
      expense: 0,
      investment: 0,
    });
  }

  transactions.forEach(t => {
    const d = new Date(t.date + 'T00:00:00');
    const m = months.find(m => m.year === d.getFullYear() && m.month === d.getMonth());
    if (!m) return;
    if (t.type === 'income') m.income += t.amount;
    if (t.type === 'expense') m.expense += t.amount;
    if (t.type === 'investment') m.investment += t.amount;
  });

  const hasData = months.some(m => m.income > 0 || m.expense > 0 || m.investment > 0);
  if (!hasData) {
    chartEl.innerHTML = `
      <div class="monthly-chart-empty" aria-hidden="true">
        <span>Add transactions to see your monthly breakdown</span>
      </div>`;
    return;
  }

  const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense, m.investment)), 1);

  chartEl.innerHTML = `
    <div class="monthly-chart-bars">
      ${months.map(m => {
    const inPct = ((m.income / maxVal) * 100).toFixed(1);
    const exPct = ((m.expense / maxVal) * 100).toFixed(1);
    const invPct = ((m.investment / maxVal) * 100).toFixed(1);
    return `
          <div class="mc-group">
            <div class="mc-bars">
              <div class="mc-bar mc-bar--income"  style="height:${inPct}%" title="Income: ${formatCurrency(m.income)}"></div>
              <div class="mc-bar mc-bar--expense" style="height:${exPct}%" title="Expense: ${formatCurrency(m.expense)}"></div>
              <div class="mc-bar mc-bar--investment" style="height:${invPct}%" title="Investment: ${formatCurrency(m.investment)}"></div>
            </div>
            <span class="mc-label">${m.label}</span>
          </div>`;
  }).join('')}
    </div>
    <div class="mc-legend">
      <span class="mc-legend-item mc-legend--income">● Income</span>
      <span class="mc-legend-item mc-legend--expense">● Expense</span>
      <span class="mc-legend-item mc-legend--investment">● Investment</span>
    </div>`;
}

/** Render the Financial Health score circle and tips */
function _renderHealthScore() {
  const scoreEl = document.getElementById('health-score-text');
  const tipsEl = document.getElementById('health-tips');
  const circleEl = document.getElementById('health-circle');
  if (!scoreEl || !tipsEl || !circleEl) return;

  if (transactions.length === 0) {
    scoreEl.textContent = '—';
    tipsEl.innerHTML = '<li class="health-tip">💡 Start tracking to get personalized tips.</li>';
    circleEl.className = 'health-circle';
    return;
  }

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalInvestment = transactions.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0);

  const totalSaved = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (totalSaved / totalIncome) * 100 : 0;
  const expenseRatio = totalIncome > 0 ? (totalExpense / totalIncome) * 100 : 100;

  // Score: 0–100
  let score = 50;
  if (savingsRate >= 30) score += 30;
  else if (savingsRate >= 20) score += 20;
  else if (savingsRate >= 10) score += 10;
  else if (savingsRate < 0) score -= 20;

  if (totalInvestment > 0) score += 10;

  if (expenseRatio <= 50) score += 10;
  else if (expenseRatio <= 70) score += 5;
  else if (expenseRatio > 90) score -= 10;

  score = Math.min(100, Math.max(0, score));

  let grade, gradeClass, tips;
  if (score >= 80) {
    grade = '🌟 Excellent'; gradeClass = 'health-circle--excellent';
    tips = ['✅ Great savings habit! Keep it up.', '💹 Investments add value to your future wealth.'];
  } else if (score >= 60) {
    grade = '👍 Good'; gradeClass = 'health-circle--good';
    tips = ['💡 Try to save/invest at least 20% of your income.', '🎯 Set a monthly budget for discretionary spending.'];
  } else if (score >= 40) {
    grade = '⚠️ Fair'; gradeClass = 'health-circle--fair';
    tips = ['⚠️ Expenses are high relative to income.', '✂️ Review your top spending categories.'];
  } else {
    grade = '🔴 Critical'; gradeClass = 'health-circle--critical';
    tips = ['🚨 Spending exceeds income — act now.', '📋 Create a strict budget and stick to it.'];
  }

  scoreEl.textContent = `${score}`;
  circleEl.className = `health-circle ${gradeClass}`;
  tipsEl.innerHTML = tips.map(t => `<li class="health-tip">${t}</li>`).join('');

  // Add grade label below score
  let gradeLabel = circleEl.querySelector('.health-grade-label');
  if (!gradeLabel) {
    gradeLabel = document.createElement('span');
    gradeLabel.className = 'health-grade-label';
    circleEl.appendChild(gradeLabel);
  }
  gradeLabel.textContent = grade;
}

/** Map category names to emoji */
function _categoryEmoji(cat) {
  const map = {
    Salary: '💼', Freelance: '🖥️', Investments: '📊', Gifts: '🎁', 'Other Income': '💡',
    Food: '🍔', Rent: '🏠', Transport: '🚗', Shopping: '🛍️', Bills: '💡',
    Healthcare: '🏥', Entertainment: '🎮', Education: '📚', Others: '📦',
    'Stocks & Shares': '📈', 'Mutual Funds': '📊', 'Fixed Deposit': '🏦',
    Crypto: '🪙', 'Real Estate': '🏢', Gold: '🥇', 'Provident Fund': '🛡️',
    'Other Investment': '💎',
  };
  return map[cat] || '📁';
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. TRANSACTION LIST RENDERER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Render a filtered, paginated set of transactions into the table.
 * @param {Array} filtered — already-filtered transaction array
 */
function renderTransactions(filtered) {
  const tbody = document.getElementById('transactions-tbody');
  const emptyState = document.getElementById('empty-state');
  const noResultsState = document.getElementById('no-results-state');
  const countBadge = document.getElementById('txn-count-badge');
  const loadMoreWrap = document.getElementById('load-more-wrap');
  if (!tbody) return;

  // Sort by date descending, then by createdAt descending for same-day stability
  const sorted = [...filtered].sort((a, b) => {
    if (b.date !== a.date) return b.date.localeCompare(a.date);
    return b.createdAt - a.createdAt;
  });

  // Update count badge
  const total = sorted.length;
  if (countBadge) countBadge.textContent = `${total} ${total === 1 ? 'entry' : 'entries'}`;

  // Empty / no-results states
  const hasTransactions = transactions.length > 0;
  const hasResults = sorted.length > 0;

  emptyState.hidden = hasTransactions || hasResults;
  noResultsState.hidden = !(hasTransactions && !hasResults);

  if (!hasResults) {
    tbody.innerHTML = '';
    if (loadMoreWrap) loadMoreWrap.hidden = true;
    return;
  }

  // Render up to visibleCount rows
  const slice = sorted.slice(0, visibleCount);
  tbody.innerHTML = slice.map(t => _buildRow(t)).join('');

  // Load More
  if (loadMoreWrap) {
    loadMoreWrap.hidden = sorted.length <= visibleCount;
  }
}

/**
 * Build an HTML table row string for one transaction.
 * @param {Object} t
 * @returns {string}
 */
function _buildRow(t) {
  let sign = '−';
  let amountCls = 'amount--expense';
  let typeCls = 'badge--expense';
  let typeLabel = '📉 Expense';

  if (t.type === 'income') {
    sign = '+';
    amountCls = 'amount--income';
    typeCls = 'badge--income';
    typeLabel = '📈 Income';
  } else if (t.type === 'investment') {
    sign = '−';
    amountCls = 'text-investment';
    typeCls = 'badge--investment';
    typeLabel = '💹 Investment';
  }

  const notesAttr = t.notes ? ` title="${_escapeHtml(t.notes)}"` : '';

  return `
    <tr class="txn-row" data-id="${t.id}">
      <td class="td-title">
        <span class="txn-title"${notesAttr}>${_escapeHtml(t.title)}</span>
        <span class="txn-category">${_categoryEmoji(t.category)} ${_escapeHtml(t.category)}</span>
        ${t.notes ? `<span class="txn-notes-indicator" title="${_escapeHtml(t.notes)}" aria-label="Has notes">📝</span>` : ''}
      </td>
      <td class="td-date">${formatDate(t.date)}</td>
      <td class="td-type"><span class="badge ${typeCls}">${typeLabel}</span></td>
      <td class="td-amount ${amountCls}">${sign}${formatCurrency(t.amount)}</td>
      <td class="td-actions">
        <button
          class="btn-icon btn-edit"
          type="button"
          data-id="${t.id}"
          aria-label="Edit transaction: ${_escapeHtml(t.title)}"
          title="Edit"
        >✏️</button>
        <button
          class="btn-icon btn-delete"
          type="button"
          data-id="${t.id}"
          aria-label="Delete transaction: ${_escapeHtml(t.title)}"
          title="Delete"
        >🗑️</button>
      </td>
    </tr>`;
}

/** Escape HTML special characters to prevent XSS in dynamic content */
function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. FILTER ENGINE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Read all current filter state, filter the transactions array,
 * update the filter status bar, and re-render the list + stats.
 */
function applyFilters() {
  const { search, category, type, dateFrom, dateTo } = activeFilters;
  const q = search.toLowerCase().trim();

  const filtered = transactions.filter(t => {
    // Text search: title or notes
    if (q && !t.title.toLowerCase().includes(q) && !t.notes.toLowerCase().includes(q)) {
      return false;
    }
    // Category filter
    if (category && t.category !== category) return false;
    // Type filter
    if (type !== 'all' && t.type !== type) return false;
    // Date range filter
    if (dateFrom && t.date < dateFrom) return false;
    if (dateTo && t.date > dateTo) return false;
    return true;
  });

  // Update filter status bar
  const filterStatus = document.getElementById('filter-status');
  const filterText = document.getElementById('filter-status-text');
  const hasActiveFilters = q || category || type !== 'all' || dateFrom || dateTo;

  if (filterStatus) {
    filterStatus.hidden = !hasActiveFilters;
    if (filterText) {
      filterText.textContent = hasActiveFilters
        ? `Showing ${filtered.length} of ${transactions.length} transactions`
        : 'Showing all transactions';
    }
  }

  // Reset pagination on new filter and re-render
  visibleCount = PAGE_SIZE;
  renderTransactions(filtered);
  updateStats();

  // Store filtered for load-more reference
  _currentFiltered = filtered;
}

/** Reference to the most recently filtered array (used by Load More) */
let _currentFiltered = [];

/* ═══════════════════════════════════════════════════════════════════════════
   8. FORM VALIDATION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Validate the transaction form. Shows inline error messages.
 * @returns {boolean} true if all fields are valid
 */
function validateForm() {
  let valid = true;

  // Title
  const titleInput = document.getElementById('txn-title');
  const titleError = document.getElementById('title-error');
  const titleVal = titleInput ? titleInput.value.trim() : '';
  if (!titleVal) {
    _showError(titleError, 'Please enter a transaction title.');
    if (titleInput) titleInput.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    _clearError(titleError);
    if (titleInput) titleInput.removeAttribute('aria-invalid');
  }

  // Amount
  const amountInput = document.getElementById('txn-amount');
  const amountError = document.getElementById('amount-error');
  const amountVal = amountInput ? parseFloat(amountInput.value) : NaN;
  if (isNaN(amountVal) || amountVal <= 0) {
    _showError(amountError, 'Please enter a valid positive amount.');
    if (amountInput) amountInput.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    _clearError(amountError);
    if (amountInput) amountInput.removeAttribute('aria-invalid');
  }

  // Category
  const catInput = document.getElementById('txn-category');
  const catError = document.getElementById('category-error');
  if (!catInput || !catInput.value) {
    _showError(catError, 'Please select a category.');
    if (catInput) catInput.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    _clearError(catError);
    if (catInput) catInput.removeAttribute('aria-invalid');
  }

  // Date
  const dateInput = document.getElementById('txn-date');
  const dateError = document.getElementById('date-error');
  const dateVal = dateInput ? dateInput.value : '';
  if (!dateVal) {
    _showError(dateError, 'Please select a valid date.');
    if (dateInput) dateInput.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    _clearError(dateError);
    if (dateInput) dateInput.removeAttribute('aria-invalid');
  }

  return valid;
}

function _showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
}

function _clearError(el) {
  if (!el) return;
  el.textContent = '';
  el.hidden = true;
}

/* ═══════════════════════════════════════════════════════════════════════════
   9. FORM SUBMIT HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Handle transaction form submission — add or update.
 * @param {Event} e
 */
function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  // Read form values
  const activeTypeBtn = document.querySelector('.type-btn.active');
  const type = activeTypeBtn ? activeTypeBtn.dataset.type : 'income';
  const title = document.getElementById('txn-title').value.trim();
  const rawAmount = parseFloat(document.getElementById('txn-amount').value);
  // Store all transaction amounts internally in INR as base currency
  const amount = toBaseINR(rawAmount);
  const category = document.getElementById('txn-category').value;
  const date = document.getElementById('txn-date').value;
  const notes = document.getElementById('txn-notes').value.trim();

  if (editingId) {
    // UPDATE existing transaction
    const idx = transactions.findIndex(t => t.id === editingId);
    if (idx !== -1) {
      transactions[idx] = { ...transactions[idx], title, amount, type, category, date, notes };
    }
    saveTransactions(transactions); // Phase 3: persist update
    showToast('Transaction updated successfully! ✏️', 'success');
  } else {
    // CREATE new transaction
    const newTxn = {
      id: generateId(),
      title,
      amount,
      type,
      category,
      date,
      notes,
      createdAt: Date.now(),
    };
    transactions.push(newTxn);
    saveTransactions(transactions); // Phase 3: persist new entry
    showToast('Transaction added successfully! ➕', 'success');
  }

  clearForm();
  updateDashboard();
  updateQuickStats();
  applyFilters();
}

/* ═══════════════════════════════════════════════════════════════════════════
   10. CLEAR FORM
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Reset the form to its "Add Transaction" default state.
 */
function clearForm() {
  const form = document.getElementById('transaction-form');
  if (form) form.reset();

  // Restore today's date
  const dateInput = document.getElementById('txn-date');
  if (dateInput) { dateInput.value = todayISO(); dateInput.max = todayISO(); }

  // Reset type toggle to Income
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  const incomeBtn = document.getElementById('type-income');
  if (incomeBtn) { incomeBtn.classList.add('active'); incomeBtn.setAttribute('aria-pressed', 'true'); }

  // Reset form heading
  const formTitleText = document.getElementById('form-title-text');
  const formTitleIcon = document.getElementById('form-title-icon');
  const submitText = document.getElementById('submit-text');
  const submitIcon = document.getElementById('submit-icon');
  if (formTitleText) formTitleText.textContent = 'Add Transaction';
  if (formTitleIcon) formTitleIcon.textContent = '➕';
  if (submitText) submitText.textContent = 'Add Transaction';
  if (submitIcon) submitIcon.textContent = '➕';

  // Update currency prefix
  const currencyPrefix = document.getElementById('currency-prefix');
  if (currencyPrefix) currencyPrefix.textContent = currencySymbol;

  // Clear validation errors
  ['title-error', 'amount-error', 'category-error', 'date-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.hidden = true; el.textContent = ''; }
  });
  ['txn-title', 'txn-amount', 'txn-category', 'txn-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.removeAttribute('aria-invalid');
  });

  editingId = null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   11. EDIT HANDLER
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Populate the form with an existing transaction for editing.
 * @param {string} id  — transaction ID
 */
function startEdit(id) {
  const txn = transactions.find(t => t.id === id);
  if (!txn) return;

  editingId = id;

  // Populate form fields (convert internal INR base amount to active currency for form input)
  document.getElementById('txn-title').value = txn.title;
  document.getElementById('txn-amount').value = convertAmount(txn.amount).toFixed(2);
  document.getElementById('txn-category').value = txn.category;
  document.getElementById('txn-date').value = txn.date;
  document.getElementById('txn-notes').value = txn.notes || '';

  // Set type toggle
  document.querySelectorAll('.type-btn').forEach(b => {
    const active = b.dataset.type === txn.type;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', String(active));
  });

  // Update form heading to edit mode
  const formTitleText = document.getElementById('form-title-text');
  const formTitleIcon = document.getElementById('form-title-icon');
  const submitText = document.getElementById('submit-text');
  const submitIcon = document.getElementById('submit-icon');
  if (formTitleText) formTitleText.textContent = 'Edit Transaction';
  if (formTitleIcon) formTitleIcon.textContent = '✏️';
  if (submitText) submitText.textContent = 'Update Transaction';
  if (submitIcon) submitIcon.textContent = '✏️';

  // Scroll the form into view (helpful on mobile)
  const formCard = document.querySelector('.form-card');
  if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Focus the title input
  const titleInput = document.getElementById('txn-title');
  if (titleInput) setTimeout(() => titleInput.focus(), 300);
}

/* ═══════════════════════════════════════════════════════════════════════════
   12. DELETE FLOW
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Show the confirmation modal before deleting a transaction.
 * @param {string} id
 */
function requestDelete(id) {
  pendingDeleteId = id;
  const modal = document.getElementById('confirm-modal');
  if (modal) {
    modal.hidden = false;
    // Phase 4: Focus the safe/cancel button by default for keyboard users
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    if (cancelBtn) setTimeout(() => cancelBtn.focus(), 60);
  }
}

/**
 * Confirm and execute the deletion.
 */
function confirmDelete() {
  if (!pendingDeleteId) return;

  // If currently editing this transaction, clear the form
  if (editingId === pendingDeleteId) clearForm();

  transactions = transactions.filter(t => t.id !== pendingDeleteId);
  saveTransactions(transactions); // Phase 3: persist deletion
  pendingDeleteId = null;

  const modal = document.getElementById('confirm-modal');
  if (modal) modal.hidden = true;

  showToast('Transaction deleted.', 'warning');
  updateDashboard();
  updateQuickStats();
  applyFilters();
}

/* ═══════════════════════════════════════════════════════════════════════════
   13. LIVE CLOCK & MISC INIT
   ═══════════════════════════════════════════════════════════════════════════ */

function updateClock() {
  const now = new Date();
  const dateEl = document.getElementById('live-date');
  const timeEl = document.getElementById('live-time');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
    });
  }
  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   14. EVENT LISTENERS & INITIALISATION
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Attach all event listeners and bootstrap the application.
 * Called once on DOMContentLoaded.
 */
function init() {

  /* ── Phase 3: Restore persisted state before first render ──────────────── */

  // 1. Theme — apply before any paint to avoid flash of wrong theme
  const _savedTheme = getStoredTheme();
  if (_savedTheme) document.documentElement.setAttribute('data-theme', _savedTheme);

  // 2. Settings (currency symbol)
  const _settings = loadSettings();
  currencySymbol = _settings.currency || '₹';
  const _currencySelectEl = document.getElementById('currency-select');
  if (_currencySelectEl) _currencySelectEl.value = currencySymbol;

  // 3. Transactions from localStorage
  transactions = loadTransactions();

  /* ── Live clock ── */
  updateClock();
  setInterval(updateClock, 1000);

  /* ── Footer year ── */
  const footerYearEl = document.getElementById('footer-year');
  if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

  /* ── Default date in form ── */
  const dateInput = document.getElementById('txn-date');
  if (dateInput) { dateInput.value = todayISO(); dateInput.max = todayISO(); }

  /* ── Currency prefix initialisation ── */
  const currencyPrefixEl = document.getElementById('currency-prefix');
  if (currencyPrefixEl) currencyPrefixEl.textContent = currencySymbol;

  /* ─────────────────────────── FORM ─────────────────────────── */
  const form = document.getElementById('transaction-form');
  if (form) form.addEventListener('submit', handleFormSubmit);

  /* ── Type toggle buttons ── */
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.type-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-pressed', 'true');
    });
  });

  /* ── Clear form button ── */
  const clearFormBtn = document.getElementById('clear-form-btn');
  if (clearFormBtn) clearFormBtn.addEventListener('click', clearForm);

  /* ─────────────────────── SEARCH & FILTERS ─────────────────── */
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');

  if (searchInput) {
    searchInput.addEventListener('input', function () {
      activeFilters.search = this.value;
      if (searchClearBtn) searchClearBtn.hidden = !this.value.trim();
      applyFilters();
    });
  }
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', function () {
      if (searchInput) searchInput.value = '';
      activeFilters.search = '';
      this.hidden = true;
      applyFilters();
    });
  }

  /* ── Category filter ── */
  const catFilterEl = document.getElementById('filter-category');
  if (catFilterEl) {
    catFilterEl.addEventListener('change', function () {
      activeFilters.category = this.value;
      applyFilters();
    });
  }

  /* ── Type filter buttons ── */
  document.querySelectorAll('.filter-type-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter-type-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      activeFilters.type = this.dataset.filter;
      applyFilters();
    });
  });

  /* ── Date range filters ── */
  const dateFromEl = document.getElementById('filter-date-from');
  const dateToEl = document.getElementById('filter-date-to');
  if (dateFromEl) {
    dateFromEl.addEventListener('change', function () {
      activeFilters.dateFrom = this.value;
      applyFilters();
    });
  }
  if (dateToEl) {
    dateToEl.addEventListener('change', function () {
      activeFilters.dateTo = this.value;
      applyFilters();
    });
  }

  /* ── Clear date filter button ── */
  const clearDateBtn = document.getElementById('clear-date-filter');
  if (clearDateBtn) {
    clearDateBtn.addEventListener('click', function () {
      if (dateFromEl) dateFromEl.value = '';
      if (dateToEl) dateToEl.value = '';
      activeFilters.dateFrom = '';
      activeFilters.dateTo = '';
      applyFilters();
    });
  }

  /* ── Reset all filters button ── */
  const resetAllBtn = document.getElementById('reset-all-filters');
  if (resetAllBtn) {
    resetAllBtn.addEventListener('click', function () {
      if (searchInput) searchInput.value = '';
      if (searchClearBtn) searchClearBtn.hidden = true;
      if (catFilterEl) catFilterEl.value = '';
      if (dateFromEl) dateFromEl.value = '';
      if (dateToEl) dateToEl.value = '';
      activeFilters.search = '';
      activeFilters.category = '';
      activeFilters.type = 'all';
      activeFilters.dateFrom = '';
      activeFilters.dateTo = '';
      document.querySelectorAll('.filter-type-btn').forEach((b, i) => {
        b.classList.toggle('active', i === 0);
      });
      applyFilters();
    });
  }

  /* ─────────────────────── TRANSACTION TABLE ─────────────────── */

  /* ── Delegated click on tbody for Edit / Delete ── */
  const tbody = document.getElementById('transactions-tbody');
  if (tbody) {
    tbody.addEventListener('click', function (e) {
      const editBtn = e.target.closest('.btn-edit');
      const deleteBtn = e.target.closest('.btn-delete');
      if (editBtn) startEdit(editBtn.dataset.id);
      if (deleteBtn) requestDelete(deleteBtn.dataset.id);
    });
  }

  /* ── Load More ── */
  const loadMoreBtn = document.getElementById('load-more-btn');
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', function () {
      visibleCount += PAGE_SIZE;
      renderTransactions(_currentFiltered);
    });
  }

  /* ─────────────────────── CONFIRM MODAL ─────────────────────── */
  const confirmModal = document.getElementById('confirm-modal');
  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', () => {
      if (confirmModal) confirmModal.hidden = true;
      pendingDeleteId = null;
    });
  }
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', confirmDelete);
  }
  if (confirmModal) {
    // Close on backdrop click
    confirmModal.addEventListener('click', function (e) {
      if (e.target === this) { this.hidden = true; pendingDeleteId = null; }
    });
    // Phase 4: Focus trap — keep Tab / Shift+Tab cycling inside the modal
    confirmModal.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      const focusable = [...this.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && confirmModal && !confirmModal.hidden) {
      confirmModal.hidden = true;
      pendingDeleteId = null;
    }
  });

  /* ─────────────────────── THEME TOGGLE ──────────────────────── */
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      const html = document.documentElement;
      const isDark = html.getAttribute('data-theme') === 'dark';
      const next = isDark ? 'light' : 'dark';
      html.setAttribute('data-theme', next);
      setStoredTheme(next); // Phase 3: persist theme preference
    });
  }

  /* ─────────────────────── CURRENCY SELECTOR ─────────────────── */
  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    currencySelect.addEventListener('change', function () {
      currencySymbol = this.value;
      updateSetting('currency', currencySymbol); // Persist currency preference in LocalStorage
      // Update the form prefix
      const prefix = document.getElementById('currency-prefix');
      if (prefix) prefix.textContent = currencySymbol;
      // Re-render all dashboard cards, monthly stats, charts, and table rows with converted values
      updateDashboard();
      updateQuickStats();
      renderTransactions(_currentFiltered);
      updateStats();
    });
  }

  /* ─────────────────────── AUTHENTICATION & USER CONTROLLER ───────────────── */

  /* ── Auth tab listeners ── */
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  if (tabLogin) tabLogin.addEventListener('click', () => switchAuthTab('login'));
  if (tabRegister) tabRegister.addEventListener('click', () => switchAuthTab('register'));

  /* ── Auth forms submission ── */
  const loginForm = document.getElementById('login-form');
  const regForm = document.getElementById('register-form');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);
  if (regForm) regForm.addEventListener('submit', handleRegisterSubmit);

  /* ── Logout button ── */
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

  /* ─────────────────────── INITIAL RENDER ─────────────────────── */
  checkAuthState();
}

/** Check current user session and toggle UI between Auth screen & Dashboard */
async function checkAuthState() {
  const user = getCurrentUser();
  const authModal = document.getElementById('auth-modal');
  const userProfileBar = document.getElementById('user-profile-bar');
  const userDisplayName = document.getElementById('user-display-name');

  // Initialize exchange rates from 12h LocalStorage cache or API
  await initExchangeRates();

  if (user) {
    // Authenticated state
    if (authModal) authModal.hidden = true;
    if (userProfileBar) userProfileBar.hidden = false;
    if (userDisplayName) userDisplayName.textContent = user.name || user.email;

    // Load active user's settings and transactions
    const settings = loadSettings();
    currencySymbol = settings.currency || '₹';
    const currencySelectEl = document.getElementById('currency-select');
    if (currencySelectEl) currencySelectEl.value = currencySymbol;

    const savedTheme = getStoredTheme();
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

    transactions = loadTransactions();
    updateDashboard();
    updateQuickStats();
    applyFilters();
  } else {
    // Unauthenticated state
    if (authModal) authModal.hidden = false;
    if (userProfileBar) userProfileBar.hidden = true;
    transactions = [];
    updateDashboard();
    updateQuickStats();
    applyFilters();
  }
}

/** Switch Auth tabs between Login and Register */
function switchAuthTab(targetTab) {
  const loginTab = document.getElementById('tab-login');
  const regTab = document.getElementById('tab-register');
  const loginPanel = document.getElementById('panel-login');
  const regPanel = document.getElementById('panel-register');
  const authAlert = document.getElementById('auth-alert');

  if (authAlert) authAlert.hidden = true;

  if (targetTab === 'login') {
    if (loginTab) { loginTab.classList.add('active'); loginTab.setAttribute('aria-selected', 'true'); }
    if (regTab) { regTab.classList.remove('active'); regTab.setAttribute('aria-selected', 'false'); }
    if (loginPanel) loginPanel.hidden = false;
    if (regPanel) regPanel.hidden = true;
  } else {
    if (regTab) { regTab.classList.add('active'); regTab.setAttribute('aria-selected', 'true'); }
    if (loginTab) { loginTab.classList.remove('active'); loginTab.setAttribute('aria-selected', 'false'); }
    if (regPanel) regPanel.hidden = false;
    if (loginPanel) loginPanel.hidden = true;
  }
}

/** Handle Login form submission */
async function handleLoginSubmit(e) {
  e.preventDefault();
  const emailInput = document.getElementById('login-email');
  const passInput = document.getElementById('login-password');
  const alertEl = document.getElementById('auth-alert');

  const email = emailInput ? emailInput.value : '';
  const password = passInput ? passInput.value : '';

  const result = await loginUser(email, password);
  if (result.success) {
    if (alertEl) {
      alertEl.className = 'auth-alert auth-alert--success';
      alertEl.textContent = 'Login successful! Loading dashboard...';
      alertEl.hidden = false;
    }
    setTimeout(() => {
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';
      if (alertEl) alertEl.hidden = true;
      checkAuthState();
      showToast(`Welcome back, ${result.user.name || result.user.email}! 👋`, 'success');
    }, 400);
  } else {
    if (alertEl) {
      alertEl.className = 'auth-alert auth-alert--error';
      alertEl.textContent = result.message;
      alertEl.hidden = false;
    }
  }
}

/** Handle Register form submission */
async function handleRegisterSubmit(e) {
  e.preventDefault();
  const nameInput = document.getElementById('reg-name');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-password');
  const alertEl = document.getElementById('auth-alert');

  const name = nameInput ? nameInput.value : '';
  const email = emailInput ? emailInput.value : '';
  const password = passInput ? passInput.value : '';

  const result = await registerUser(name, email, password);
  if (result.success) {
    if (alertEl) {
      alertEl.className = 'auth-alert auth-alert--success';
      alertEl.textContent = 'Account created successfully!';
      alertEl.hidden = false;
    }
    setTimeout(() => {
      if (nameInput) nameInput.value = '';
      if (emailInput) emailInput.value = '';
      if (passInput) passInput.value = '';
      if (alertEl) alertEl.hidden = true;
      checkAuthState();
      showToast(`Account created! Welcome, ${result.user.name}! 🎉`, 'success');
    }, 400);
  } else {
    if (alertEl) {
      alertEl.className = 'auth-alert auth-alert--error';
      alertEl.textContent = result.message;
      alertEl.hidden = false;
    }
  }
}

/** Handle Logout button */
function handleLogout() {
  logoutUser();
  checkAuthState();
  showToast('Logged out securely.', 'info');
}

/* ── Bootstrap on DOM ready ── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

