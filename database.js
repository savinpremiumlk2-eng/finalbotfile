const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' || process.env.REPLIT_DEPLOYMENT ? { rejectUnauthorized: false } : false,
});

let globalSettingsCache = {
  maintenance: false,
  forceBot: false,
  antidelete: false,
  autoStatus: false
};
let moderatorsCache = [];

async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS dashboard_users (
      username TEXT PRIMARY KEY,
      password TEXT,
      data TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      userid TEXT,
      folder TEXT,
      name TEXT,
      ownername TEXT,
      ownernumber TEXT,
      settings TEXT DEFAULT '{}',
      creds TEXT,
      addedat BIGINT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS global_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS group_settings (
      groupid TEXT PRIMARY KEY,
      settings TEXT
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS moderators (
      userid TEXT PRIMARY KEY
    )`);

    await client.query(`CREATE TABLE IF NOT EXISTS user_settings (
      username TEXT PRIMARY KEY,
      settings TEXT DEFAULT '{}'
    )`);

    const colCheck = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'moderators' AND column_name = 'userId'`);
    if (colCheck.rows.length > 0) {
      await client.query(`ALTER TABLE moderators RENAME COLUMN "userId" TO userid`);
      console.log("✅ Migrated moderators.userId to lowercase");
    }
    const colCheck2 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'group_settings' AND column_name = 'groupId'`);
    if (colCheck2.rows.length > 0) {
      await client.query(`ALTER TABLE group_settings RENAME COLUMN "groupId" TO groupid`);
      console.log("✅ Migrated group_settings.groupId to lowercase");
    }

    const settingsRows = await client.query("SELECT * FROM global_settings");
    if (settingsRows.rows) {
      settingsRows.rows.forEach(row => {
        try {
          globalSettingsCache[row.key] = JSON.parse(row.value);
        } catch (e) {
          globalSettingsCache[row.key] = row.value;
        }
      });
      console.log("✅ Global settings loaded into cache");
    }

    const modRows = await client.query('SELECT userid FROM moderators');
    if (modRows.rows) {
      moderatorsCache = modRows.rows.map(r => r.userid);
    }

    const sessionsJsonPath = path.join(__dirname, 'database', 'sessions.json');
    if (fs.existsSync(sessionsJsonPath)) {
      try {
        const sessions = JSON.parse(fs.readFileSync(sessionsJsonPath, 'utf8'));
        for (const [id, data] of Object.entries(sessions)) {
          await client.query(
            `INSERT INTO sessions (id, userid, folder, name, ownername, ownernumber, settings, addedat)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), data.addedAt || Date.now()]
          );
        }
        console.log("✅ Sessions synced from JSON to PostgreSQL");
      } catch (e) {
        console.error("❌ Error syncing sessions:", e.message);
      }
    }
  } finally {
    client.release();
  }
}

initDatabase().catch(err => console.error("❌ Database init error:", err.message));

const query = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result.rows;
};

const run = async (sql, params = []) => {
  const result = await pool.query(sql, params);
  return result;
};

module.exports = {
  saveDashboardUser: async (username, password) => {
    return await run(
      `INSERT INTO dashboard_users (username, password) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password`,
      [username, password]
    );
  },
  getDashboardUser: async (username) => {
    const rows = await query("SELECT * FROM dashboard_users WHERE username = $1", [username]);
    return rows[0];
  },
  query: async (sql, params = []) => {
    return await query(sql, params);
  },

  getGlobalSettings: async () => {
    return globalSettingsCache;
  },
  getGlobalSettingsSync: () => {
    return globalSettingsCache;
  },
  updateGlobalSettings: async (settings) => {
    for (const [key, value] of Object.entries(settings)) {
      globalSettingsCache[key] = value;
      await run(
        `INSERT INTO global_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, JSON.stringify(value)]
      );
    }
    return true;
  },

  getGroupSettings: async (groupId) => {
    const rows = await query('SELECT settings FROM group_settings WHERE groupid = $1', [groupId]);
    if (rows.length > 0) return JSON.parse(rows[0].settings);

    const config = require('./config');
    const defaultSettings = { ...config.defaultGroupSettings };
    await run(
      'INSERT INTO group_settings (groupid, settings) VALUES ($1, $2) ON CONFLICT (groupid) DO NOTHING',
      [groupId, JSON.stringify(defaultSettings)]
    );
    return defaultSettings;
  },
  updateGroupSettings: async (groupId, settings) => {
    const current = await module.exports.getGroupSettings(groupId);
    const updated = { ...current, ...settings };
    return await run(
      `INSERT INTO group_settings (groupid, settings) VALUES ($1, $2)
       ON CONFLICT (groupid) DO UPDATE SET settings = EXCLUDED.settings`,
      [groupId, JSON.stringify(updated)]
    );
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
      return await run('INSERT INTO moderators (userid) VALUES ($1) ON CONFLICT DO NOTHING', [userId]);
    }
    return false;
  },
  removeModerator: async (userId) => {
    moderatorsCache = moderatorsCache.filter(id => id !== userId);
    return await run('DELETE FROM moderators WHERE userid = $1', [userId]);
  },

  getAllSessions: async () => {
    const rows = await query("SELECT * FROM sessions");
    return rows.reduce((acc, row) => {
      acc[row.id] = {
        userId: row.userid,
        folder: row.folder,
        name: row.name,
        ownerName: row.ownername,
        ownerNumber: row.ownernumber,
        settings: JSON.parse(row.settings || '{}'),
        creds: row.creds,
        addedAt: row.addedat
      };
      return acc;
    }, {});
  },
  saveSession: async (id, data) => {
    const existingCreds = await query("SELECT creds FROM sessions WHERE id = $1", [id]);
    const creds = (data.creds) ? data.creds : (existingCreds.length > 0 ? existingCreds[0].creds : null);
    return await run(
      `INSERT INTO sessions (id, userid, folder, name, ownername, ownernumber, settings, creds, addedat)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         userid = EXCLUDED.userid, folder = EXCLUDED.folder, name = EXCLUDED.name,
         ownername = EXCLUDED.ownername, ownernumber = EXCLUDED.ownernumber,
         settings = EXCLUDED.settings, creds = EXCLUDED.creds, addedat = EXCLUDED.addedat`,
      [id, data.userId, data.folder, data.name, data.ownerName, data.ownerNumber, JSON.stringify(data.settings || {}), creds, data.addedAt || Date.now()]
    );
  },
  saveSessionCreds: async (id, creds) => {
    return await run("UPDATE sessions SET creds = $1 WHERE id = $2", [creds, id]);
  },
  deleteSession: async (id) => {
    return await run("DELETE FROM sessions WHERE id = $1", [id]);
  },

  getUserSettings: async (username) => {
    const rows = await query("SELECT settings FROM user_settings WHERE username = $1", [username]);
    if (rows.length > 0) {
      try { return JSON.parse(rows[0].settings); } catch (e) { return {}; }
    }
    return {};
  },
  updateUserSettings: async (username, settings) => {
    const current = await module.exports.getUserSettings(username);
    const updated = { ...current, ...settings };
    await run(
      `INSERT INTO user_settings (username, settings) VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET settings = EXCLUDED.settings`,
      [username, JSON.stringify(updated)]
    );
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
