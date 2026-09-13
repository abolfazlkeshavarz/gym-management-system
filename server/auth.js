const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const secretFile = path.join(__dirname, '..', 'data', '.jwt-secret');
let JWT_SECRET;
try {
  JWT_SECRET = fs.readFileSync(secretFile, 'utf8').trim();
} catch {
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(secretFile), { recursive: true });
  fs.writeFileSync(secretFile, JWT_SECRET, { mode: 0o600 });
}

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'ورود مدیریت لازم است.' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'نشست منقضی شده است، دوباره وارد شوید.' });
  }
}

module.exports = { signToken, requireAuth };
