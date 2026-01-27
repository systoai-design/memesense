/**
 * User Credits and Tier Management
 * Uses Turso (LibSQL) for cloud database
 */

const { createClient } = require('@libsql/client');
const { v4: uuidv4 } = require('uuid');

// Tier configurations
const TIERS = {
  FREE: {
    name: 'Free',
    dailyLimit: 5,
    features: ['basic_analysis', 'top5_holders', '24h_data'],
    refreshRate: 300
  },
  PREMIUM: {
    name: 'Premium',
    dailyLimit: -1,
    features: ['advanced_analysis', 'top50_holders', '7d_data', 'export', 'realtime'],
    refreshRate: 30
  },
  TRIAL: {
    name: 'Premium Trial',
    dailyLimit: -1,
    features: ['advanced_analysis', 'top50_holders', '7d_data', 'export', 'realtime'],
    refreshRate: 30
  }
};

const CREDIT_RATES = {
  SOL: 100,
  USDC: 10
};

// Singleton client
let client = null;

function getClient() {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    console.warn("WARNING: TURSO_DATABASE_URL or TURSO_AUTH_TOKEN not set. Using mocked DB for build/test.");
    return {
      execute: async () => ({ rows: [] })
    };
  }

  client = createClient({
    url,
    authToken
  });

  return client;
}

/**
 * Get or create a user by device ID or wallet address
 */
async function getOrCreateUser({ deviceId, walletAddress }) {
  const db = getClient();
  let user = null;

  if (walletAddress) {
    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE wallet_address = ?',
      args: [walletAddress]
    });
    user = res.rows[0];

    // FOUND BY WALLET: Return immediately. This is the source of truth.
    if (user) {
      // Optional: Update device_id if needed, but not critical for premium access
      return user;
    }
  }

  if (!user && deviceId) {
    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE device_id = ?',
      args: [deviceId]
    });
    user = res.rows[0];

    // FIX: If user found by device but we have a walletAddress now, update the record!
    if (user && walletAddress && user.wallet_address !== walletAddress) {
      console.log(`Linking wallet ${walletAddress} to existing device user ${user.id}`);
      try {
        await db.execute({
          sql: 'UPDATE users SET wallet_address = ? WHERE id = ?',
          args: [walletAddress, user.id]
        });
        // Update local object
        user.wallet_address = walletAddress;
      } catch (e) {
        console.error("Failed to link wallet to user", e);
      }
    }
  }

  if (!user) {
    const id = uuidv4();
    try {
      await db.execute({
        sql: `INSERT INTO users (id, wallet_address, device_id, tier, credits) VALUES (?, ?, ?, 'FREE', 0)`,
        args: [id, walletAddress || null, deviceId || uuidv4()]
      });

      const res = await db.execute({
        sql: 'SELECT * FROM users WHERE id = ?',
        args: [id]
      });
      user = res.rows[0];
    } catch (e) {
      console.error("Error creating user", e);
    }
  }

  return user;
}

/**
 * Check if user can perform an analysis
 */
async function canUseAnalysis(userId, depth = 'normal') {
  const db = getClient();

  const userRes = await db.execute({
    sql: 'SELECT * FROM users WHERE id = ?',
    args: [userId]
  });
  const user = userRes.rows[0];

  if (!user) {
    return { allowed: false, reason: 'User not found', remainingToday: 0 };
  }

  let tierName = user.tier;

  // CHECK TRIAL EXPIRATION
  if (tierName === 'TRIAL' && user.trial_start) {
    const trialStart = new Date(user.trial_start).getTime();
    const now = Date.now();
    const diffHours = (now - trialStart) / (1000 * 60 * 60);

    if (diffHours > 72) {
      tierName = 'FREE';
      db.execute({
        sql: "UPDATE users SET tier = 'FREE' WHERE id = ?",
        args: [user.id]
      }).catch(e => console.error("Failed to downgrade expired trial user", e));
    }
  }

  // CHECK SUBSCRIPTION EXPIRATION (For Monthly)
  if (tierName === 'PREMIUM' && user.subscription_expiry) {
    const expiry = new Date(user.subscription_expiry).getTime();
    const now = Date.now();

    if (now > expiry) {
      console.log(`User ${userId} subscription expired on ${user.subscription_expiry}. Downgrading to FREE.`);
      tierName = 'FREE';
      db.execute({
        sql: "UPDATE users SET tier = 'FREE', subscription_expiry = NULL WHERE id = ?",
        args: [user.id]
      }).catch(e => console.error("Failed to downgrade expired subscription", e));
    }
  }

  // TIER LIMITS CONFIG
  const TIER_LIMITS = {
    FREE: { normal: 10, deep: 0 },
    PREMIUM: { normal: 30, deep: 10 },
    TRIAL: { normal: 30, deep: 10 }
  };

  const limits = TIER_LIMITS[tierName] || TIER_LIMITS.FREE;
  const isDeep = depth === 'deep';

  // Check Permission for Deep Scan
  if (isDeep && limits.deep === 0) {
    return {
      allowed: false,
      reason: 'Deep Scan is a Premium feature. Upgrade to unlock.',
      remainingToday: 0
    };
  }

  const today = new Date().toISOString().split('T')[0];
  const queryAction = isDeep ? 'deep_analysis' : 'analysis';

  const usageRes = await db.execute({
    sql: 'SELECT COUNT(*) as count FROM usage WHERE user_id = ? AND date(created_at) = ? AND action = ?',
    args: [userId, today, queryAction]
  });

  const usedToday = usageRes.rows[0]?.count || 0;
  const limit = isDeep ? limits.deep : limits.normal;
  const remainingToday = Math.max(0, limit - usedToday);

  if (usedToday >= limit) {
    return {
      allowed: false,
      reason: `Daily ${isDeep ? 'Deep Scan' : 'scan'} limit reached (${limit}). Upgrade for more.`,
      remainingToday: 0
    };
  }

  return { allowed: true, reason: 'OK', remainingToday };
}

/**
 * Record an analysis usage
 */
async function recordUsage(userId, tokenAddress, action = 'analysis') {
  const db = getClient();
  try {
    await db.execute({
      sql: "INSERT INTO usage (user_id, action, token_address, credits_used) VALUES (?, ?, ?, 1)",
      args: [userId, action, tokenAddress]
    });

    await db.execute({
      sql: 'UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [userId]
    });
  } catch (e) {
    console.error("Error recording usage", e);
  }
}

/**
 * Record a scan details for history
 */
async function recordScan(userId, tokenData, type = 'token') {
  const db = getClient();
  try {
    await db.execute({
      sql: `INSERT INTO scans (user_id, token_address, name, symbol, image_url, type) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [
        userId,
        tokenData.address,
        tokenData.name,
        tokenData.symbol,
        tokenData.imageUrl || null,
        type
      ]
    });
  } catch (e) {
    console.error("Error recording scan", e);
  }
}

/**
 * Check if user has scanned this token recently
 */
async function hasUserScanned(userId, tokenAddress) {
  const db = getClient();
  try {
    const res = await db.execute({
      sql: "SELECT id FROM usage WHERE user_id = ? AND token_address = ? AND action = 'analysis'",
      args: [userId, tokenAddress]
    });
    return res.rows.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Get global recent scans
 */
async function getRecentScans(userId, limit = 10, type = 'token') {
  const db = getClient();
  try {
    const res = await db.execute({
      sql: `SELECT s.token_address, s.name, s.symbol, s.image_url, MAX(s.created_at) as created_at,
                   l.label as user_label
            FROM scans s
            LEFT JOIN wallet_labels l ON s.user_id = l.user_id AND s.token_address = l.wallet_address
            WHERE s.user_id = ? AND s.type = ?
            GROUP BY s.token_address 
            ORDER BY created_at DESC 
            LIMIT ?`,
      args: [userId, type, limit]
    });
    return res.rows;
  } catch (e) {
    console.error("Error fetching recent scans", e);
    return [];
  }
}

/**
 * Add credits to a user account
 */
async function addCredits(userId, credits, txInfo = {}) {
  const db = getClient();

  try {
    if (txInfo.signature) {
      await db.execute({
        sql: `INSERT INTO transactions (user_id, tx_signature, amount, currency, credits_added, status)
              VALUES (?, ?, ?, ?, ?, 'completed')`,
        args: [userId, txInfo.signature, txInfo.amount, txInfo.currency, credits]
      });
    }

    await db.execute({
      sql: 'UPDATE users SET credits = credits + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      args: [credits, userId]
    });

    await db.execute({
      sql: "UPDATE users SET tier = 'PREMIUM' WHERE id = ? AND credits > 0",
      args: [userId]
    });

    const res = await db.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId]
    });
    return res.rows[0];
  } catch (e) {
    console.error("Error adding credits", e);
    return null;
  }
}

/**
 * Get user's usage history
 */
async function getUsageHistory(userId, limit = 50) {
  const db = getClient();
  try {
    const res = await db.execute({
      sql: 'SELECT * FROM usage WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      args: [userId, limit]
    });
    return res.rows;
  } catch (e) {
    return [];
  }
}

/**
 * Get user's transaction history
 */
async function getTransactionHistory(userId, limit = 50) {
  const db = getClient();
  try {
    const res = await db.execute({
      sql: 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      args: [userId, limit]
    });
    return res.rows;
  } catch (e) {
    return [];
  }
}


/**
 * Onboard a user
 */
async function onboardUser(walletAddress) {
  const db = getClient();
  try {
    await db.execute({
      sql: 'UPDATE users SET is_onboarded = 1 WHERE wallet_address = ?',
      args: [walletAddress]
    });
    return true;
  } catch (e) {
    console.error("Error onboardUser", e);
    return false;
  }
}

/**
 * Upgrade user tier
 */
async function upgradeUser(walletAddress, plan = 'lifetime') {
  const db = getClient();
  try {
    const res = await db.execute({
      sql: 'SELECT id FROM users WHERE wallet_address = ?',
      args: [walletAddress]
    });
    const user = res.rows[0];
    if (!user) return false;

    let expiry = null;
    if (plan === 'monthly') {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Add 30 days
      expiry = date.toISOString();
    } else if (plan === 'lifetime') {
      expiry = null; // Explicitly null for lifetime
    }

    try {
      // Force clear expiry for lifetime upgrades to prevent downgrade logic from triggering
      await db.execute({
        sql: 'UPDATE users SET tier = ?, subscription_expiry = ? WHERE id = ?',
        args: ['PREMIUM', expiry, user.id]
      });
    } catch (sqlError) {
      // Column might be missing
      console.warn("Attempting to add missing 'subscription_expiry' column...", sqlError.message);
      try {
        await db.execute({ sql: "ALTER TABLE users ADD COLUMN subscription_expiry TEXT" });
        // Retry
        await db.execute({
          sql: 'UPDATE users SET tier = ?, subscription_expiry = ? WHERE id = ?',
          args: ['PREMIUM', expiry, user.id]
        });
      } catch (retryError) {
        console.error("Failed to update user after adding column", retryError);
        // Fallback for old schema if ALTER fails? 
        // Just fail for now, implies DB issue.
        return false;
      }
    }

    return true;
  } catch (e) {
    console.error("Error upgradeUser", e);
    return false;
  }
}

/**
 * Get tier information
 */
function getTierInfo(tierName) {
  return TIERS[tierName] || TIERS.FREE;
}

/**
 * Set a label for a wallet
 */
async function setWalletLabel(userId, walletAddress, label) {
  const db = getClient();
  try {
    await db.execute({
      sql: `INSERT INTO wallet_labels (user_id, wallet_address, label) 
                  VALUES (?, ?, ?)
                  ON CONFLICT(user_id, wallet_address) 
                  DO UPDATE SET label = ?, updated_at = CURRENT_TIMESTAMP`,
      args: [userId, walletAddress, label, label]
    });
    return true;
  } catch (e) {
    console.error("Error setting wallet label", e);
    return false;
  }
}

/**
 * Get a label for a wallet
 */
async function getWalletLabel(userId, walletAddress) {
  const db = getClient();
  try {
    const res = await db.execute({
      sql: 'SELECT label FROM wallet_labels WHERE user_id = ? AND wallet_address = ?',
      args: [userId, walletAddress]
    });
    return res.rows[0]?.label || null;
  } catch (e) {
    return null;
  }
}

/**
 * Get cached wallet history if fresh (< 5 minutes old)
 * @param {string} walletAddress 
 * @returns {object|null} Cached data or null if stale/missing
 */
async function getWalletCache(walletAddress) {
  const db = getClient();
  const CACHE_TTL_SECONDS = 300; // 5 minutes

  try {
    const res = await db.execute({
      sql: `SELECT trades, created_at FROM wallet_cache 
            WHERE wallet_address = ? 
            AND datetime(created_at) > datetime('now', '-' || ? || ' seconds')`,
      args: [walletAddress, CACHE_TTL_SECONDS]
    });

    if (res.rows.length > 0) {
      return JSON.parse(res.rows[0].trades);
    }
    return null;
  } catch (e) {
    // Table might not exist yet
    if (e.message.includes('no such table')) {
      console.log('[DB] Creating wallet_cache table...');
      await db.execute({
        sql: `CREATE TABLE IF NOT EXISTS wallet_cache (
          wallet_address TEXT PRIMARY KEY,
          trades TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      });
    }
    return null;
  }
}

/**
 * Store wallet history in cache
 * @param {string} walletAddress 
 * @param {Array} trades 
 */
async function setWalletCache(walletAddress, trades) {
  const db = getClient();

  try {
    // Ensure table exists
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS wallet_cache (
        wallet_address TEXT PRIMARY KEY,
        trades TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    });

    await db.execute({
      sql: `INSERT OR REPLACE INTO wallet_cache (wallet_address, trades, created_at) 
            VALUES (?, ?, CURRENT_TIMESTAMP)`,
      args: [walletAddress, JSON.stringify(trades)]
    });
  } catch (e) {
    console.error('[DB] Failed to cache wallet history:', e.message);
  }
}

/**
 * Initialize wallet_trades table for permanent storage
 */
async function initWalletTradesTable() {
  const db = getClient();
  try {
    await db.execute({
      sql: `CREATE TABLE IF NOT EXISTS wallet_trades (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        signature TEXT NOT NULL,
        type TEXT NOT NULL,
        mint TEXT NOT NULL,
        token_amount REAL,
        sol_amount REAL,
        timestamp INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(wallet_address, signature)
      )`
    });
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_wallet_trades_wallet ON wallet_trades(wallet_address)`
    });
    await db.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_wallet_trades_timestamp ON wallet_trades(wallet_address, timestamp DESC)`
    });
  } catch (e) {
    console.warn('[DB] Table init warning:', e.message);
  }
}

/**
 * Get all stored trades for a wallet
 */
async function getStoredTrades(walletAddress) {
  const db = getClient();
  try {
    await initWalletTradesTable();
    const res = await db.execute({
      sql: `SELECT signature, type, mint, token_amount as tokenAmount, sol_amount as solAmount, timestamp 
            FROM wallet_trades 
            WHERE wallet_address = ? 
            ORDER BY timestamp DESC`,
      args: [walletAddress]
    });
    return res.rows.map(row => ({
      signature: row.signature,
      type: row.type,
      mint: row.mint,
      tokenAmount: row.tokenAmount,
      solAmount: row.solAmount,
      timestamp: row.timestamp
    }));
  } catch (e) {
    console.error('[DB] getStoredTrades error:', e.message);
    return [];
  }
}

/**
 * Get the timestamp of the most recent stored trade
 */
async function getLatestTradeTimestamp(walletAddress) {
  const db = getClient();
  try {
    await initWalletTradesTable();
    const res = await db.execute({
      sql: `SELECT MAX(timestamp) as latest FROM wallet_trades WHERE wallet_address = ?`,
      args: [walletAddress]
    });
    return res.rows[0]?.latest || null;
  } catch (e) {
    console.error('[DB] getLatestTradeTimestamp error:', e.message);
    return null;
  }
}

/**
 * Store trades in bulk (ignores duplicates via UNIQUE constraint)
 */
async function storeWalletTrades(walletAddress, trades) {
  const db = getClient();
  if (!trades || trades.length === 0) return;

  try {
    await initWalletTradesTable();

    // Batch insert with INSERT OR IGNORE
    for (const trade of trades) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO wallet_trades 
              (wallet_address, signature, type, mint, token_amount, sol_amount, timestamp) 
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          walletAddress,
          trade.signature,
          trade.type,
          trade.mint,
          trade.tokenAmount,
          trade.solAmount,
          trade.timestamp
        ]
      });
    }
    console.log(`[DB] Stored ${trades.length} trades for ${walletAddress}`);
  } catch (e) {
    console.error('[DB] storeWalletTrades error:', e.message);
  }
}

module.exports = {
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
  onboardUser,
  upgradeUser,
  activateTrial,
  setWalletLabel,
  getWalletLabel,
  getWalletCache,
  setWalletCache,
  getStoredTrades,
  getLatestTradeTimestamp,
  storeWalletTrades,
  TIERS,
  CREDIT_RATES
};

/**
 * Activate Trial for a user
 */
async function activateTrial(userId) {
  const db = getClient();
  const now = new Date().toISOString();
  try {
    await db.execute({
      sql: "UPDATE users SET tier = 'TRIAL', trial_start = ? WHERE id = ?",
      args: [now, userId]
    });
    return true;
  } catch (e) {
    console.error("Error activating trial (First Attempt):", e);
    // Likely missing column 'trial_start'. Attempt to add it and retry.
    try {
      console.log("Attempting to add missing 'trial_start' column...");
      await db.execute({
        sql: "ALTER TABLE users ADD COLUMN trial_start TEXT" // SQLite/LibSQL uses TEXT for ISO dates usually, or just use generic add
      });
      // Retry Update
      await db.execute({
        sql: "UPDATE users SET tier = 'TRIAL', trial_start = ? WHERE id = ?",
        args: [now, userId]
      });
      return true;
    } catch (retryError) {
      console.error("Error activating trial (Retry Failed):", retryError);
      return false;
    }
  }
}
