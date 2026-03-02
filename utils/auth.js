const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const usersDbPath = path.join(__dirname, '..', 'database', 'users.json');

if (!fs.existsSync(usersDbPath)) {
  fs.writeFileSync(usersDbPath, JSON.stringify({}, null, 2));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

module.exports = {
  register: (username, password) => {
    const users = JSON.parse(fs.readFileSync(usersDbPath, 'utf-8'));
    if (users[username]) return false;
    users[username] = { password: hashPassword(password) };
    fs.writeFileSync(usersDbPath, JSON.stringify(users, null, 2));
    return true;
  },
  login: (username, password) => {
    const users = JSON.parse(fs.readFileSync(usersDbPath, 'utf-8'));
    if (!users[username]) return false;
    return users[username].password === hashPassword(password);
  }
};
