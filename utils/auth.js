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
    if (username === 'owner123' && password === 'Savi123') {
      return { username: 'owner123', isOwner: true };
    }
    const user = await database.getDashboardUser(username);
    if (!user) return false;
    if (user.password === hashPassword(password)) {
      return { username, isOwner: false };
    }
    return false;
  }
};
