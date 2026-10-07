// Stateless session middleware: an HMAC-signed cookie instead of server memory.
// Server-memory sessions (express-session) break on serverless platforms like
// Vercel, where every invocation may land on a different instance.
const crypto = require('crypto');

// On Vercel a well-known default secret would let anyone forge a session
// cookie for any librarian, so refuse to boot until one is configured.
if (process.env.VERCEL && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET is required on Vercel. Set it with `vercel env add SESSION_SECRET production`.');
}

const SECRET = process.env.SESSION_SECRET || 'librarysecret';
const COOKIE_NAME = 'athenaeum';
const MAX_AGE_MS = 1000 * 60 * 60 * 12; // 12 hours

function sign(data) {
    return crypto.createHmac('sha256', SECRET).update(data).digest('base64url');
}

function serialize(librarian) {
    const payload = Buffer.from(
        JSON.stringify({ librarian, exp: Date.now() + MAX_AGE_MS })
    ).toString('base64url');
    return `${payload}.${sign(payload)}`;
}

function deserialize(token) {
    if (!token) return null;
    const sep = token.lastIndexOf('.');
    if (sep < 0) return null;
    const payload = token.slice(0, sep);
    const mac = token.slice(sep + 1);
    const expected = sign(payload);
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        if (!data.exp || data.exp < Date.now()) return null;
        return data.librarian || null;
    } catch {
        return null;
    }
}

function parseCookies(header) {
    const out = {};
    if (!header) return out;
    for (const part of header.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    return out;
}

module.exports = function cookieSession(req, res, next) {
    let current = deserialize(parseCookies(req.headers.cookie)[COOKIE_NAME]);

    const sendCookie = (value, maxAge) => {
        const attrs = [
            `${COOKIE_NAME}=${value}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            `Max-Age=${maxAge}`
        ];
        if (req.secure) attrs.push('Secure');
        res.append('Set-Cookie', attrs.join('; '));
    };

    const session = {
        get librarian() {
            return current;
        },
        set librarian(value) {
            current = value;
            sendCookie(serialize(value), Math.floor(MAX_AGE_MS / 1000));
        },
        destroy(callback) {
            current = null;
            sendCookie('', 0);
            if (callback) callback();
        }
    };

    Object.defineProperty(req, 'session', { value: session, configurable: true });
    next();
};
