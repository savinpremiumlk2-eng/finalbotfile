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
    addedAt INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS group_settings (
    groupId TEXT PRIMARY KEY,
    settings TEXT
  )`);

  // Initial cache load
  db.all("SELECT * FROM global_settings", (err, rows) => {
    if (!err && rows) {
      rows.forEach(row => {
        try {
          globalSettingsCache[row.key] = JSON.parse(row.value);
        } catch (e) {
          globalSettingsCache[row.key] = row.value;
        }
      });
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
        addedAt: row.addedAt
      };
      return acc;
    }, {});
  },
  saveSession: async (id, data) => {
    return await run(
      "INSERT OR REPLACE INTO sessions (id, userId, folder, name, ownerName, ownerNumber, settings, addedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), data.addedAt || Date.now()]
    );
  },
  deleteSession: async (id) => {
    return await run("DELETE FROM sessions WHERE id = ?", [id]);
  }
};
