/**
 * storage.js — Personal Finance Tracker
 * LocalStorage read/write helpers & Auth persistence
 *   – Safe JSON parse/stringify with try-catch (handles private browsing / quota errors)
 *   – User Authentication & Account Storage ('users', 'currentUser')
 *   – SHA-256 Password Hashing via Web Crypto API
 *   – User-Isolated Data Persistence (transactions, currency, theme, settings under 'userData')
 *   – Investment transaction type support
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   STORAGE KEYS
   ═══════════════════════════════════════════════════════════════════════════ */

const STORAGE_KEYS = {
  users:               'users',
  currentUser:         'currentUser',
  exchangeRates:       'finance_tracker_exchange_rates',
  ratesTimestamp:      'finance_tracker_rates_updated_at',
  // Legacy global fallback keys for migration if needed
  legacyTransactions: 'finance_tracker_transactions',
  legacyTheme:        'finance_tracker_theme',
  legacySettings:     'finance_tracker_settings',
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
   2. PASSWORD HASHING (SECURITY)
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Hash a plain text password using the browser Web Crypto API (SHA-256).
 * Never stores plain text passwords in LocalStorage.
 * @param {string} password
 * @returns {Promise<string>} hex-encoded SHA-256 hash
 */
async function hashPassword(password) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback simple hash string if Web Crypto subtle is unavailable
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `fallback_hash_${Math.abs(hash)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. USER ACCOUNT PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Fetch all registered users array from localStorage.
 * @returns {Array<Object>} list of users [{id, name, email, passwordHash, createdAt}]
 */
function getUsers() {
  const users = storageGet(STORAGE_KEYS.users);
  return Array.isArray(users) ? users : [];
}

/**
 * Persist the users array to localStorage.
 * @param {Array<Object>} users
 */
function saveUsers(users) {
  return storageSet(STORAGE_KEYS.users, users);
}

/**
 * Get current logged in user's email identifier.
 * @returns {string|null}
 */
function getCurrentUserEmail() {
  return storageGet(STORAGE_KEYS.currentUser);
}

/**
 * Set current logged in user's email identifier.
 * @param {string|null} email
 */
function setCurrentUserEmail(email) {
  if (!email) {
    storageRemove(STORAGE_KEYS.currentUser);
  } else {
    storageSet(STORAGE_KEYS.currentUser, email.toLowerCase().trim());
  }
}

/**
 * Retrieve current logged in user object.
 * @returns {Object|null} user profile without sensitive raw credentials
 */
function getCurrentUser() {
  const email = getCurrentUserEmail();
  if (!email) return null;
  const users = getUsers();
  const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  return found || null;
}

/**
 * Clear login session.
 */
function logoutUser() {
  storageRemove(STORAGE_KEYS.currentUser);
}

/**
 * Register a new user with validation.
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string, user?: Object}>}
 */
async function registerUser(name, email, password) {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();

  // 1. Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    return { success: false, message: 'Please enter a valid email address.' };
  }

  // 2. Password length validation
  if (!password || password.length < 8) {
    return { success: false, message: 'Password must be at least 8 characters long.' };
  }

  // 3. Name validation
  if (!cleanName) {
    return { success: false, message: 'Please enter your full name.' };
  }

  // 4. Duplicate email check
  const users = getUsers();
  const duplicate = users.some(u => u.email.toLowerCase() === cleanEmail);
  if (duplicate) {
    return { success: false, message: 'An account with this email already exists.' };
  }

  // 5. Hash password and save
  const passwordHash = await hashPassword(password);
  const newUser = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    email: cleanEmail,
    passwordHash: passwordHash,
    createdAt: Date.now(),
  };

  users.push(newUser);
  saveUsers(users);

  // Initialize user-specific isolated data store
  initUserData(cleanEmail);

  // Log in new user
  setCurrentUserEmail(cleanEmail);

  return { success: true, message: 'Account registered successfully!', user: newUser };
}

/**
 * Authenticate existing user.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string, user?: Object}>}
 */
async function loginUser(email, password) {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { success: false, message: 'Please enter both email and password.' };
  }

  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    return { success: false, message: 'No account found with this email.' };
  }

  const inputHash = await hashPassword(password);
  if (user.passwordHash !== inputHash) {
    return { success: false, message: 'Incorrect password. Please try again.' };
  }

  setCurrentUserEmail(cleanEmail);
  return { success: true, message: 'Logged in successfully!', user };
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. USER-SCOPED DATA STORE ('userData')
   ═══════════════════════════════════════════════════════════════════════════ */

/** Default settings fallback */
const DEFAULT_SETTINGS = {
  currency: '₹',
};

/**
 * Returns key name for user-isolated data store.
 * e.g., 'userData_john@example.com'
 */
function getUserDataKey(email) {
  const current = email || getCurrentUserEmail() || 'guest';
  return `userData_${current.toLowerCase().trim()}`;
}

/**
 * Get full isolated data package for specified user.
 */
function getUserData(email) {
  const key = getUserDataKey(email);
  const data = storageGet(key);
  if (data && typeof data === 'object') return data;
  return {
    transactions: [],
    currency: '₹',
    theme: 'light',
    settings: { ...DEFAULT_SETTINGS },
  };
}

/**
 * Persist full isolated data package for specified user.
 */
function saveUserData(email, data) {
  const key = getUserDataKey(email);
  return storageSet(key, data);
}

/**
 * Create default storage entry for a brand new user.
 */
function initUserData(email) {
  const key = getUserDataKey(email);
  if (!storageGet(key)) {
    storageSet(key, {
      transactions: [],
      currency: '₹',
      theme: 'light',
      settings: { ...DEFAULT_SETTINGS },
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. ISOLATED TRANSACTION PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Load saved transactions array for the current active user.
 * Supports Income, Expense, and Investment types.
 * @returns {Array<Object>}
 */
function loadTransactions() {
  const uData = getUserData();
  const data = uData.transactions;
  if (!Array.isArray(data)) return [];
  return data.filter(t =>
    t &&
    typeof t.id        === 'string' &&
    typeof t.title     === 'string' &&
    typeof t.amount    === 'number' &&
    (t.type === 'income' || t.type === 'expense' || t.type === 'investment') &&
    typeof t.category  === 'string' &&
    typeof t.date      === 'string'
  );
}

/**
 * Persist transactions array for the current active user.
 * @param {Array<Object>} transactions
 * @returns {boolean}
 */
function saveTransactions(transactions) {
  const uData = getUserData();
  uData.transactions = transactions;
  return saveUserData(getCurrentUserEmail(), uData);
}

/**
 * Clear active user's transactions.
 */
function clearTransactions() {
  const uData = getUserData();
  uData.transactions = [];
  saveUserData(getCurrentUserEmail(), uData);
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. ISOLATED THEME & SETTINGS PERSISTENCE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Read current user's theme preference ('light' | 'dark').
 * @returns {'light'|'dark'|null}
 */
function getStoredTheme() {
  const uData = getUserData();
  if (uData.theme === 'light' || uData.theme === 'dark') return uData.theme;
  return null;
}

/**
 * Save current user's theme preference.
 * @param {'light'|'dark'} theme
 */
function setStoredTheme(theme) {
  if (theme === 'light' || theme === 'dark') {
    const uData = getUserData();
    uData.theme = theme;
    saveUserData(getCurrentUserEmail(), uData);
  }
}

/**
 * Load current user's settings.
 * @returns {Object}
 */
function loadSettings() {
  const uData = getUserData();
  return { ...DEFAULT_SETTINGS, ...(uData.settings || {}), currency: uData.currency || DEFAULT_SETTINGS.currency };
}

/**
 * Save settings for current active user.
 * @param {Object} settings
 * @returns {boolean}
 */
function saveSettings(settings) {
  const uData = getUserData();
  uData.settings = { ...settings };
  if (settings.currency) uData.currency = settings.currency;
  return saveUserData(getCurrentUserEmail(), uData);
}

/**
 * Update a single setting for current user.
 * @param {string} key
 * @param {any} value
 */
function updateSetting(key, value) {
  const uData = getUserData();
  if (!uData.settings) uData.settings = { ...DEFAULT_SETTINGS };
  uData.settings[key] = value;
  if (key === 'currency') uData.currency = value;
  saveUserData(getCurrentUserEmail(), uData);
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. LIVE EXCHANGE RATE CACHING
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Load cached exchange rates from localStorage.
 * @returns {Object|null}
 */
function getCachedExchangeRates() {
  return storageGet(STORAGE_KEYS.exchangeRates);
}

/**
 * Persist exchange rates map to localStorage.
 * @param {Object} rates
 */
function saveCachedExchangeRates(rates) {
  return storageSet(STORAGE_KEYS.exchangeRates, rates);
}

/**
 * Load timestamp of last exchange rate API update.
 * @returns {number|null}
 */
function getRatesTimestamp() {
  return storageGet(STORAGE_KEYS.ratesTimestamp);
}

/**
 * Persist exchange rate update timestamp to localStorage.
 * @param {number} timestamp
 */
function saveRatesTimestamp(timestamp) {
  return storageSet(STORAGE_KEYS.ratesTimestamp, timestamp);
}


