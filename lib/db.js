/**
 * User Credits and Tier Management
 * Uses SQLite for local development
 */

const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Database path
const DB_PATH = path.join(process.cwd(), 'data', 'memesense.db');

// Tier configurations
// NOTE: dailyLimit set to -1 (unlimited) for development/testing
const TIERS = {
  FREE: {
    name: 'Free',
    dailyLimit: 5, // Enforce limit: 5 scans per day
    features: ['basic_analysis', 'top5_holders', '24h_data'],
    refreshRate: 300 // 5 minutes
  },
  PREMIUM: {
    name: 'Premium',
    dailyLimit: -1, // Unlimited
    features: ['advanced_analysis', 'top50_holders', '7d_data', 'export', 'realtime'],
    refreshRate: 30 // 30 seconds
  }
};

// Credit rates
const CREDIT_RATES = {
  SOL: 100, // 1 SOL = 100 credits
  USDC: 10  // 1 USDC = 10 credits
};

let db = null;

/**
 * Initialize database
 */
function initDatabase() {
  if (db) return db;

  // Ensure data directory exists
  const fs = require('fs');
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE,
      device_id TEXT,
      tier TEXT DEFAULT 'FREE',
      credits INTEGER DEFAULT 0,
      is_onboarded INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      token_address TEXT,
      credits_used INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      tx_signature TEXT UNIQUE,
      amount REAL,
      currency TEXT,
      credits_added INTEGER,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_usage_user_date ON usage(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
    
    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      token_address TEXT NOT NULL,
      name TEXT,
      symbol TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_scans_user_token ON scans(user_id, token_address);
    CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at);
  `);

  // Migration: Ensure is_onboarded column exists
  try {
    const tableInfo = db.pragma('table_info(users)');
    const hasOnboarded = tableInfo.some(col => col.name === 'is_onboarded');
    if (!hasOnboarded) {
      db.prepare('ALTER TABLE users ADD COLUMN is_onboarded INTEGER DEFAULT 0').run();
    }
  } catch (err) {
    console.warn('Migration warning:', err.message);
  }

  return db;
}

/**
 * Get or create a user by device ID or wallet address
 * @param {object} options - { deviceId, walletAddress }
 * @returns {object} User object
 */
function getOrCreateUser({ deviceId, walletAddress }) {
  const database = initDatabase();

  let user = null;

  if (walletAddress) {
    user = database.prepare('SELECT * FROM users WHERE wallet_address = ?').get(walletAddress);
  }

  if (!user && deviceId) {
    user = database.prepare('SELECT * FROM users WHERE device_id = ?').get(deviceId);
  }

  if (!user) {
    const id = uuidv4();
    database.prepare(`
      INSERT INTO users (id, wallet_address, device_id, tier, credits)
      VALUES (?, ?, ?, 'FREE', 0)
    `).run(id, walletAddress || null, deviceId || uuidv4());

    user = database.prepare('SELECT * FROM users WHERE id = ?').get(id);
  }

  return user;
}

/**
 * Check if user can perform an analysis
 * @param {string} userId - User ID
 * @returns {object} { allowed, reason, remainingToday }
 */
function canUseAnalysis(userId) {
  const database = initDatabase();

  const user = database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) {
    return { allowed: false, reason: 'User not found', remainingToday: 0 };
  }

  const tier = TIERS[user.tier] || TIERS.FREE;

  // Premium users have unlimited access
  if (tier.dailyLimit === -1) {
    return { allowed: true, reason: 'Premium access', remainingToday: -1 };
  }

  // Check daily usage for free users
  const today = new Date().toISOString().split('T')[0];
  const usageToday = database.prepare(`
    SELECT COUNT(*) as count FROM usage 
    WHERE user_id = ? AND DATE(created_at) = ?
  `).get(userId, today);

  const usedToday = usageToday?.count || 0;
  const remainingToday = Math.max(0, tier.dailyLimit - usedToday);

  if (usedToday >= tier.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit reached (${tier.dailyLimit} analyses). Upgrade to Premium for unlimited access.`,
      remainingToday: 0
    };
  }

  return { allowed: true, reason: 'OK', remainingToday };
}

/**
 * Record an analysis usage
 * @param {string} userId - User ID
 * @param {string} tokenAddress - Token that was analyzed
 */
function recordUsage(userId, tokenAddress) {
  const database = initDatabase();

  database.prepare(`
    INSERT INTO usage (user_id, action, token_address, credits_used)
    VALUES (?, 'analysis', ?, 1)
  `).run(userId, tokenAddress);

  // Update user's last activity
  database.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}

/**
 * Record a scan details for history
 */
function recordScan(userId, tokenData) {
  const database = initDatabase();

  // Check if recently scanned by same user (e.g. last 1 hour) to avoid duplicates in list?
  // Or just insert, and we filter duplicates on select. 
  // Let's just insert for log, but maybe update if exists?
  // No, let's just insert, easy.

  database.prepare(`
        INSERT INTO scans (user_id, token_address, name, symbol, image_url)
        VALUES (?, ?, ?, ?, ?)
    `).run(
    userId,
    tokenData.address,
    tokenData.name,
    tokenData.symbol,
    tokenData.imageUrl || null
  );
}

/**
 * Check if user has scanned this token recently (to avoid double charging)
 * Returns true if scanned ever (or within X days). Let's say Forever for now (Buy once logic),
 * or maybe just reset daily? "charge people again" implies "pay once".
 * Let's assume: If you analyzed it, you don't pay again.
 */
function hasUserScanned(userId, tokenAddress) {
  const database = initDatabase();
  // Check usage table for 'analysis' action
  const result = database.prepare(`
        SELECT id FROM usage 
        WHERE user_id = ? AND token_address = ? AND action = 'analysis'
    `).get(userId, tokenAddress);
  return !!result;
}

/**
 * Get global recent scans
 */
function getRecentScans(userId, limit = 10) {
  const database = initDatabase();
  return database.prepare(`
        SELECT token_address, name, symbol, image_url, MAX(created_at) as created_at 
        FROM scans 
        WHERE user_id = ?
        GROUP BY token_address 
        ORDER BY created_at DESC 
        LIMIT ?
    `).all(userId, limit);
}

/**
 * Add credits to a user account
 * @param {string} userId - User ID
 * @param {number} credits - Credits to add
 * @param {object} txInfo - Transaction info { signature, amount, currency }
 * @returns {object} Updated user
 */
function addCredits(userId, credits, txInfo = {}) {
  const database = initDatabase();

  // Record transaction
  if (txInfo.signature) {
    database.prepare(`
      INSERT INTO transactions (user_id, tx_signature, amount, currency, credits_added, status)
      VALUES (?, ?, ?, ?, ?, 'completed')
    `).run(userId, txInfo.signature, txInfo.amount, txInfo.currency, credits);
  }

  // Update user credits
  database.prepare(`
    UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(credits, userId);

  // Auto-upgrade to premium if credits > 0
  database.prepare(`
    UPDATE users SET tier = 'PREMIUM' WHERE id = ? AND credits > 0
  `).run(userId);

  return database.prepare('SELECT * FROM users WHERE id = ?').get(userId);
}

/**
 * Get user's usage history
 * @param {string} userId - User ID
 * @param {number} limit - Number of records
 * @returns {array} Usage history
 */
function getUsageHistory(userId, limit = 50) {
  const database = initDatabase();

  return database.prepare(`
    SELECT * FROM usage 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(userId, limit);
}

/**
 * Get user's transaction history
 * @param {string} userId - User ID
 * @param {number} limit - Number of records
 * @returns {array} Transaction history
 */
function getTransactionHistory(userId, limit = 50) {
  const database = initDatabase();

  return database.prepare(`
    SELECT * FROM transactions 
    WHERE user_id = ? 
    ORDER BY created_at DESC 
    LIMIT ?
  `).all(userId, limit);
}

/**
 * Get tier information
 * @param {string} tierName - Tier name
 * @returns {object} Tier config
 */
function getTierInfo(tierName) {
  return TIERS[tierName] || TIERS.FREE;
}

module.exports = {
  initDatabase,
  getOrCreateUser,
  canUseAnalysis,
  recordUsage,
  recordScan,
  hasUserScanned,
  getRecentScans,
  addCredits,
  getUsageHistory,
  getTransactionHistory,
  getTierInfo,
  TIERS,
  CREDIT_RATES
};
