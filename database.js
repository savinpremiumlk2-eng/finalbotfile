const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(__dirname, 'database', 'bot.db');

// Ensure database directory exists
if (!fs.existsSync(path.join(__dirname, 'database'))) {
  fs.mkdirSync(path.join(__dirname, 'database'), { recursive: true });
}

const db = new sqlite3.Database(DB_FILE);
let globalSettingsCache = {
  maintenance: false,
  forceBot: false,
  antidelete: false,
  autoStatus: false
};
let moderatorsCache = [];

// Initialize Tables and Cache
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS dashboard_users (
    username TEXT PRIMARY KEY,
    password TEXT,
    data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    folder TEXT,
    name TEXT,
    ownerName TEXT,
    ownerNumber TEXT,
    settings TEXT,
    creds TEXT,
    addedAt INTEGER
  )`, (err) => {
    if (!err) {
      db.run("ALTER TABLE sessions ADD COLUMN creds TEXT", (alterErr) => {
        // Ignore "duplicate column name" error
      });
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS group_settings (
    groupId TEXT PRIMARY KEY,
    settings TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS moderators (
    userId TEXT PRIMARY KEY
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS user_settings (
    username TEXT PRIMARY KEY,
    settings TEXT DEFAULT '{}'
  )`);

  // Initial global settings cache load
  db.all("SELECT * FROM global_settings", (err, rows) => {
    if (!err && rows) {
      rows.forEach(row => {
        try {
          globalSettingsCache[row.key] = JSON.parse(row.value);
        } catch (e) {
          globalSettingsCache[row.key] = row.value;
        }
      });
      console.log("✅ Global settings loaded into cache");
    }
  });

  // Load existing sessions into DB if sessions.json exists (migration/sync)
  const sessionsJsonPath = path.join(__dirname, 'database', 'sessions.json');
  if (fs.existsSync(sessionsJsonPath)) {
    try {
      const sessions = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
      Object.entries(sessions).forEach(([id, data]) => {
        db.run(
          "INSERT OR IGNORE INTO sessions (id, userId, folder, name, ownerName, ownerNumber, settings, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), data.addedAt || Date.now()]
        );
      });
      console.log("✅ Sessions synced from JSON to SQLite");
    } catch (e) {
      console.error("❌ Error syncing sessions:", e.message);
    }
  }

  // Initial moderators cache load
  db.all("SELECT userId FROM moderators", (err, rows) => {
    if (!err && rows) {
      moderatorsCache = rows.map(r => r.userId);
    }
  });
});

const query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

module.exports = {
  // Authentication (Dashboard Users)
  saveDashboardUser: async (username, password) => {
    return await run("INSERT OR REPLACE INTO dashboard_users (username, password) VALUES (?, ?)", [username, password]);
  },
  getDashboardUser: async (username) => {
    const rows = await query("SELECT * FROM dashboard_users WHERE username = ?", [username]);
    return rows[0];
  },
  query: async (sql, params = []) => {
    return await query(sql, params);
  },

  // Global Settings
  getGlobalSettings: async () => {
    return globalSettingsCache;
  },
  getGlobalSettingsSync: () => {
    return globalSettingsCache;
  },
  updateGlobalSettings: async (settings) => {
    for (const [key, value] of Object.entries(settings)) {
      globalSettingsCache[key] = value;
      await run("INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
    }
    return true;
  },

  // Group Settings
  getGroupSettings: async (groupId) => {
    const rows = await query("SELECT settings FROM group_settings WHERE groupId = ?", [groupId]);
    if (rows.length > 0) return JSON.parse(rows[0].settings);
    
    const config = require('./config');
    const defaultSettings = { ...config.defaultGroupSettings };
    await run("INSERT INTO group_settings (groupId, settings) VALUES (?, ?)", [groupId, JSON.stringify(defaultSettings)]);
    return defaultSettings;
  },
  updateGroupSettings: async (groupId, settings) => {
    const current = await module.exports.getGroupSettings(groupId);
    const updated = { ...current, ...settings };
    return await run("INSERT OR REPLACE INTO group_settings (groupId, settings) VALUES (?, ?)", [groupId, JSON.stringify(updated)]);
  },

  // Moderators System
  getModerators: async () => {
    return moderatorsCache;
  },
  isModerator: (userId) => {
    return moderatorsCache.includes(userId);
  },
  addModerator: async (userId) => {
    if (!moderatorsCache.includes(userId)) {
      moderatorsCache.push(userId);
      return await run("INSERT OR IGNORE INTO moderators (userId) VALUES (?)", [userId]);
    }
    return false;
  },
  removeModerator: async (userId) => {
    moderatorsCache = moderatorsCache.filter(id => id !== userId);
    return await run("DELETE FROM moderators WHERE userId = ?", [userId]);
  },

  // Sessions
  getAllSessions: async () => {
    const rows = await query("SELECT * FROM sessions");
    return rows.reduce((acc, row) => {
      acc[row.id] = {
        userId: row.userId,
        folder: row.folder,
        name: row.name,
        ownerName: row.ownerName,
        ownerNumber: row.ownerNumber,
        settings: JSON.parse(row.settings || '{}'),
        creds: row.creds,
        addedAt: row.addedAt
      };
      return acc;
    }, {});
  },
  saveSession: async (id, data) => {
    return await run(
      "INSERT OR REPLACE INTO sessions (id, userId, folder, name, ownerName, ownerNumber, settings, creds, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT creds FROM sessions WHERE id = ?), ?)",
      [id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), id, data.addedAt || Date.now()]
    );
  },
  saveSessionCreds: async (id, creds) => {
    return await run("UPDATE sessions SET creds = ? WHERE id = ?", [creds, id]);
  },
  deleteSession: async (id) => {
    return await run("DELETE FROM sessions WHERE id = ?", [id]);
  },

  // User Settings (per-user, applies to all their bots)
  getUserSettings: async (username) => {
    const rows = await query("SELECT settings FROM user_settings WHERE username = ?", [username]);
    if (rows.length > 0) {
      try { return JSON.parse(rows[0].settings); } catch (e) { return {}; }
    }
    return {};
  },
  updateUserSettings: async (username, settings) => {
    const current = await module.exports.getUserSettings(username);
    const updated = { ...current, ...settings };
    await run("INSERT OR REPLACE INTO user_settings (username, settings) VALUES (?, ?)", [username, JSON.stringify(updated)]);
    return updated;
  },

  // Deleted Messages (In-memory only for performance, as before)
  deletedMessagesCache: new Map(),
  saveDeletedMessage: (id, data) => {
    module.exports.deletedMessagesCache.set(id, data);
    setTimeout(() => module.exports.deletedMessagesCache.delete(id), 3600000);
  },
  getDeletedMessage: (id) => {
    return module.exports.deletedMessagesCache.get(id);
  }
};
