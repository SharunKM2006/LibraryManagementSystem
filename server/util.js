const crypto = require('crypto');

// Salted scrypt password hashing (no external dependency needed).
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.startsWith('scrypt$')) return false;
    const [, salt, expected] = stored.split('$');
    const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(derived, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function startOfDay(date = new Date()) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysFromNow(days) {
    const d = startOfDay();
    d.setDate(d.getDate() + days);
    return d;
}

module.exports = { hashPassword, verifyPassword, startOfDay, daysFromNow };
