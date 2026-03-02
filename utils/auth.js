const crypto = require('crypto');
const database = require('../database');

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
  register: async (username, password) => {
    const existing = await database.getDashboardUser(username);
    if (existing) return false;
    await database.saveDashboardUser(username, hashPassword(password));
    return true;
  },
  login: async (username, password) => {
    const user = await database.getDashboardUser(username);
    if (!user) return false;
    return user.password === hashPassword(password);
  }
};
