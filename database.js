const sqlite3 = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = sqlite3(path.join(dbDir, 'bot.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

let globalSettingsCache = {
  maintenance: false,
  forceBot: false,
  antidelete: false,
  autoStatus: false
};
let moderatorsCache = [];

function initDatabase() {
  db.exec(`CREATE TABLE IF NOT EXISTS dashboard_users (
    username TEXT PRIMARY KEY,
    password TEXT,
    data TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    folder TEXT,
    name TEXT,
    ownerName TEXT,
    ownerNumber TEXT,
    settings TEXT DEFAULT '{}',
    creds TEXT,
    addedAt INTEGER
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS global_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS group_settings (
    groupId TEXT PRIMARY KEY,
    settings TEXT
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS moderators (
    userId TEXT PRIMARY KEY
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS user_settings (
    username TEXT PRIMARY KEY,
    settings TEXT DEFAULT '{}'
  )`);

  const settingsRows = db.prepare("SELECT * FROM global_settings").all();
  settingsRows.forEach(row => {
    try {
      globalSettingsCache[row.key] = JSON.parse(row.value);
    } catch (e) {
      globalSettingsCache[row.key] = row.value;
    }
  });
  console.log("✅ Global settings loaded into cache");

  const modRows = db.prepare('SELECT userId FROM moderators').all();
  moderatorsCache = modRows.map(r => r.userId);

  const sessionsJsonPath = path.join(__dirname, 'database', 'sessions.json');
  if (fs.existsSync(sessionsJsonPath)) {
    try {
      const sessions = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
      const stmt = db.prepare(
        `INSERT OR IGNORE INTO sessions (id, userId, folder, name, ownerName, ownerNumber, settings, addedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const [id, data] of Object.entries(sessions)) {
        stmt.run(id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), data.addedAt || Date.now());
      }
      console.log("✅ Sessions synced from JSON to SQLite");
    } catch (e) {
      console.error("❌ Error syncing sessions:", e.message);
    }
  }
}

try {
  initDatabase();
} catch (err) {
  console.error("❌ Database init error:", err.message);
}

module.exports = {
  saveDashboardUser: async (username, password) => {
    return db.prepare(
      `INSERT OR REPLACE INTO dashboard_users (username, password) VALUES (?, ?)`
    ).run(username, password);
  },
  getDashboardUser: async (username) => {
    return db.prepare("SELECT * FROM dashboard_users WHERE username = ?").get(username);
  },
  query: async (sql, params = []) => {
    if (sql.trim().toUpperCase().startsWith('SELECT')) {
      return db.prepare(sql).all(...params);
    }
    return db.prepare(sql).run(...params);
  },

  getGlobalSettings: async () => {
    return globalSettingsCache;
  },
  getGlobalSettingsSync: () => {
    return globalSettingsCache;
  },
  updateGlobalSettings: async (settings) => {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)`
    );
    for (const [key, value] of Object.entries(settings)) {
      globalSettingsCache[key] = value;
      stmt.run(key, JSON.stringify(value));
    }
    return true;
  },

  getGroupSettings: async (groupId) => {
    const row = db.prepare('SELECT settings FROM group_settings WHERE groupId = ?').get(groupId);
    if (row) return JSON.parse(row.settings);

    const config = require('./config');
    const defaultSettings = { ...config.defaultGroupSettings };
    db.prepare('INSERT OR IGNORE INTO group_settings (groupId, settings) VALUES (?, ?)').run(groupId, JSON.stringify(defaultSettings));
    return defaultSettings;
  },
  updateGroupSettings: async (groupId, settings) => {
    const current = await module.exports.getGroupSettings(groupId);
    const updated = { ...current, ...settings };
    return db.prepare(
      `INSERT OR REPLACE INTO group_settings (groupId, settings) VALUES (?, ?)`
    ).run(groupId, JSON.stringify(updated));
  },

  getModerators: async () => {
    return moderatorsCache;
  },
  isModerator: (userId) => {
    return moderatorsCache.includes(userId);
  },
  addModerator: async (userId) => {
    if (!moderatorsCache.includes(userId)) {
      moderatorsCache.push(userId);
      return db.prepare('INSERT OR IGNORE INTO moderators (userId) VALUES (?)').run(userId);
    }
    return false;
  },
  removeModerator: async (userId) => {
    moderatorsCache = moderatorsCache.filter(id => id !== userId);
    return db.prepare('DELETE FROM moderators WHERE userId = ?').run(userId);
  },

  getAllSessions: async () => {
    const rows = db.prepare("SELECT * FROM sessions").all();
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
    const existing = db.prepare("SELECT creds FROM sessions WHERE id = ?").get(id);
    const creds = data.creds ? data.creds : (existing ? existing.creds : null);
    return db.prepare(
      `INSERT OR REPLACE INTO sessions (id, userId, folder, name, ownerName, ownerNumber, settings, creds, addedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), creds, data.addedAt || Date.now());
  },
  saveSessionCreds: async (id, creds) => {
    return db.prepare("UPDATE sessions SET creds = ? WHERE id = ?").run(creds, id);
  },
  deleteSession: async (id) => {
    return db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  },

  getUserSettings: async (username) => {
    const row = db.prepare("SELECT settings FROM user_settings WHERE username = ?").get(username);
    if (row) {
      try { return JSON.parse(row.settings); } catch (e) { return {}; }
    }
    return {};
  },
  updateUserSettings: async (username, settings) => {
    const current = await module.exports.getUserSettings(username);
    const updated = { ...current, ...settings };
    db.prepare(
      `INSERT OR REPLACE INTO user_settings (username, settings) VALUES (?, ?)`
    ).run(username, JSON.stringify(updated));
    return updated;
  },

  deletedMessagesCache: new Map(),
  saveDeletedMessage: (id, data) => {
    module.exports.deletedMessagesCache.set(id, data);
    setTimeout(() => module.exports.deletedMessagesCache.delete(id), 3600000);
  },
  getDeletedMessage: (id) => {
    return module.exports.deletedMessagesCache.get(id);
  }
};
