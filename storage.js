/**
 * storage.js — Personal Finance Tracker
 * Phase 3: LocalStorage read/write helpers
 *   – Safe JSON parse/stringify with try-catch (handles private browsing / quota errors)
 *   – Transactions CRUD persistence
 *   – Theme preference persistence
 *   – Settings (currency) persistence
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   STORAGE KEYS
   ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  transactions: 'finance_tracker_transactions',
  theme:        'finance_tracker_theme',
  settings:     'finance_tracker_settings',
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. LOW-LEVEL SAFE WRAPPERS
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Safely read a JSON value from localStorage.
 * Returns null if the key is missing, unparseable, or storage is unavailable.
 * @param {string} key
 * @returns {any|null}
 */
function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[storage] Failed to read "${key}":`, err);
    return null;
  }
}

/**
 * Safely write a JSON-serialisable value to localStorage.
 * Silently no-ops if storage is unavailable or quota is exceeded.
 * @param {string} key
 * @param {any} value
 * @returns {boolean} true if the write succeeded
 */
function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.warn(`[storage] Failed to write "${key}":`, err);
    return false;
  }
}

/**
 * Safely remove a key from localStorage.
 * @param {string} key
 */
function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.warn(`[storage] Failed to remove "${key}":`, err);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. TRANSACTION PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Load the saved transactions array from localStorage.
 * Returns an empty array if nothing is stored yet or data is corrupt.
 * @returns {Array<Object>}
 */
function loadTransactions() {
  const data = storageGet(STORAGE_KEYS.transactions);
  if (!Array.isArray(data)) return [];
  // Validate each entry has the required shape; filter out any malformed ones
  return data.filter(t =>
    t &&
    typeof t.id        === 'string' &&
    typeof t.title     === 'string' &&
    typeof t.amount    === 'number' &&
    (t.type === 'income' || t.type === 'expense') &&
    typeof t.category  === 'string' &&
    typeof t.date      === 'string'
  );
}

/**
 * Persist the entire transactions array to localStorage.
 * @param {Array<Object>} transactions
 * @returns {boolean} true if successful
 */
function saveTransactions(transactions) {
  return storageSet(STORAGE_KEYS.transactions, transactions);
}

/**
 * Clear all saved transaction data from localStorage.
 */
function clearTransactions() {
  storageRemove(STORAGE_KEYS.transactions);
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. THEME PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Read the saved theme preference ('light' | 'dark').
 * Returns null if not yet set.
 * @returns {'light'|'dark'|null}
 */
function getStoredTheme() {
  const theme = storageGet(STORAGE_KEYS.theme);
  if (theme === 'light' || theme === 'dark') return theme;
  return null;
}

/**
 * Save the user's theme preference to localStorage.
 * @param {'light'|'dark'} theme
 */
function setStoredTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    storageSet(STORAGE_KEYS.theme, theme);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. SETTINGS PERSISTENCE (currency, etc.)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Default settings object.
 * @type {Object}
 */
const DEFAULT_SETTINGS = {
  currency: '₹',
};

/**
 * Load user settings from localStorage.
 * Merges stored values with defaults so new settings always have a fallback.
 * @returns {Object}
 */
function loadSettings() {
  const stored = storageGet(STORAGE_KEYS.settings);
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SETTINGS };
  return { ...DEFAULT_SETTINGS, ...stored };
}

/**
 * Save user settings object to localStorage.
 * @param {Object} settings
 * @returns {boolean}
 */
function saveSettings(settings) {
  return storageSet(STORAGE_KEYS.settings, settings);
}

/**
 * Update a single setting key and persist.
 * @param {string} key
 * @param {any} value
 */
function updateSetting(key, value) {
  const current = loadSettings();
  current[key] = value;
  saveSettings(current);
}
