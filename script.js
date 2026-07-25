/**
 * script.js — Personal Finance Tracker
 * Phase 1: Initialises the live clock, footer year, and default date.
 * Phase 2 will add full transaction CRUD and filter logic.
 * Phase 3 will connect Local Storage and Theme toggling.
 */

/* ─── LIVE CLOCK ────────────────────────────────────────────────────────── */
function updateClock() {
  const now       = new Date();
  const dateEl    = document.getElementById('live-date');
  const timeEl    = document.getElementById('live-time');

  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-IN', {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  if (timeEl) {
    timeEl.textContent = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
  }
}

// Tick immediately then every second
updateClock();
setInterval(updateClock, 1000);

/* ─── FOOTER YEAR ────────────────────────────────────────────────────────── */
const footerYearEl = document.getElementById('footer-year');
if (footerYearEl) footerYearEl.textContent = new Date().getFullYear();

/* ─── DEFAULT DATE FOR FORM ──────────────────────────────────────────────── */
const dateInput = document.getElementById('txn-date');
if (dateInput) {
  const today = new Date().toISOString().split('T')[0];
  dateInput.value     = today;
  dateInput.max       = today;
}

/* ─── MONTHLY QUICK-STATS LABEL ─────────────────────────────────────────── */
const qsMonthEl = document.getElementById('qs-month');
if (qsMonthEl) {
  qsMonthEl.textContent = new Date().toLocaleDateString('en-IN', {
    month: 'long', year: 'numeric'
  });
}

/* ─── EMPTY STATE VISIBILITY (Phase 1 default) ───────────────────────────── */
const emptyState   = document.getElementById('empty-state');
const tbody        = document.getElementById('transactions-tbody');
if (emptyState && tbody && tbody.children.length === 0) {
  emptyState.style.display = '';
}

/* ─── PHASE 2+ PLACEHOLDERS ─────────────────────────────────────────────── */
// These event listeners will be fully implemented in Phase 2.

// Form submission
const form = document.getElementById('transaction-form');
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    // Phase 2: will call handleFormSubmit()
  });
}

// Type toggle buttons
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

// Type filter buttons
document.querySelectorAll('.filter-type-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.filter-type-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    // Phase 2: will call applyFilters()
  });
});

// Theme toggle (Phase 3 full implementation; basic DOM toggle for Phase 1 demo)
const themeToggleBtn = document.getElementById('theme-toggle-btn');
if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', function () {
    const html      = document.documentElement;
    const isDark    = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  });
}

// Clear form button
const clearFormBtn = document.getElementById('clear-form-btn');
if (clearFormBtn) {
  clearFormBtn.addEventListener('click', function () {
    if (form) form.reset();
    const dateInp = document.getElementById('txn-date');
    if (dateInp) dateInp.value = new Date().toISOString().split('T')[0];
    // Reset type toggle back to Income
    document.querySelectorAll('.type-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    const incomeBtn = document.getElementById('type-income');
    if (incomeBtn) { incomeBtn.classList.add('active'); incomeBtn.setAttribute('aria-pressed', 'true'); }
    // Clear form title
    const formTitleText = document.getElementById('form-title-text');
    const formTitleIcon = document.getElementById('form-title-icon');
    const submitText    = document.getElementById('submit-text');
    const submitIcon    = document.getElementById('submit-icon');
    if (formTitleText) formTitleText.textContent = 'Add Transaction';
    if (formTitleIcon) formTitleIcon.textContent = '➕';
    if (submitText) submitText.textContent = 'Add Transaction';
    if (submitIcon) submitIcon.textContent = '➕';
    document.getElementById('edit-id').value = '';
  });
}

// Search clear button
const searchInput    = document.getElementById('search-input');
const searchClearBtn = document.getElementById('search-clear-btn');
if (searchInput && searchClearBtn) {
  searchInput.addEventListener('input', function () {
    searchClearBtn.hidden = this.value.trim() === '';
    // Phase 2: will call applyFilters()
  });
  searchClearBtn.addEventListener('click', function () {
    searchInput.value   = '';
    this.hidden         = true;
    // Phase 2: will call applyFilters()
  });
}

// Confirm modal buttons (Phase 3 full integration)
const confirmModal     = document.getElementById('confirm-modal');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
if (confirmCancelBtn && confirmModal) {
  confirmCancelBtn.addEventListener('click', () => { confirmModal.hidden = true; });
}

// Close modal on overlay click
if (confirmModal) {
  confirmModal.addEventListener('click', function (e) {
    if (e.target === this) this.hidden = true;
  });
}

// Close modal on Escape key
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && confirmModal && !confirmModal.hidden) {
    confirmModal.hidden = true;
  }
});

// Clear date filters
const clearDateBtn = document.getElementById('clear-date-filter');
if (clearDateBtn) {
  clearDateBtn.addEventListener('click', function () {
    const fromInput = document.getElementById('filter-date-from');
    const toInput   = document.getElementById('filter-date-to');
    if (fromInput) fromInput.value = '';
    if (toInput)   toInput.value   = '';
    // Phase 2: will call applyFilters()
  });
}

// Reset all filters
const resetAllBtn = document.getElementById('reset-all-filters');
if (resetAllBtn) {
  resetAllBtn.addEventListener('click', function () {
    if (searchInput) { searchInput.value = ''; if (searchClearBtn) searchClearBtn.hidden = true; }
    const catFilter = document.getElementById('filter-category');
    if (catFilter) catFilter.value = '';
    const fromFilter = document.getElementById('filter-date-from');
    const toFilter   = document.getElementById('filter-date-to');
    if (fromFilter) fromFilter.value = '';
    if (toFilter)   toFilter.value   = '';
    document.querySelectorAll('.filter-type-btn').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    const filterStatus = document.getElementById('filter-status');
    if (filterStatus) filterStatus.hidden = true;
    // Phase 2: will call applyFilters()
  });
}
