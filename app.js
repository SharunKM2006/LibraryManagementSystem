const express = require('express');
const path = require('path');
const fs = require('fs');

const { connectDb } = require('./server/db');
const { autoSeed } = require('./server/seed');
const apiRouter = require('./server/routes');
const cookieSession = require('./server/session');

const CLIENT_DIST = path.join(__dirname, 'client', 'dist');

let appPromise = null;

async function buildApp() {
    const db = await connectDb();
    await autoSeed();

    const app = express();
    // Vercel and other proxies terminate TLS upstream; trust the first hop so
    // req.secure (and Secure cookies) behave correctly.
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use(cookieSession);

    // REST API for the React SPA
    app.use('/api', apiRouter);
    app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
    app.use((err, req, res, next) => {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    });

    // Serve the built React client when running as a plain Node server;
    // on Vercel the platform serves statics and routes /api to this app.
    if (fs.existsSync(CLIENT_DIST)) {
        app.use(express.static(CLIENT_DIST));
    }
    app.use((req, res, next) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
        const indexFile = path.join(CLIENT_DIST, 'index.html');
        if (fs.existsSync(indexFile)) return res.sendFile(indexFile);
        res.status(503).send('Client not built yet. Run "npm run build", or use "npm run dev" for the Vite dev server.');
    });

    app.locals.db = db;
    return app;
}

// Cached across warm invocations on serverless; local `node app.js` uses it once.
function createApp() {
    if (!appPromise) {
        appPromise = buildApp().catch(err => {
            appPromise = null;
            throw err;
        });
    }
    return appPromise;
}

module.exports = createApp;

if (require.main === module) {
    // Render injects $PORT; treat unset or "0" (sandbox default) as the dev port.
    const PORT = process.env.PORT && process.env.PORT !== '0' ? process.env.PORT : 5000;
    createApp()
        .then(app => {
            const server = app.listen(PORT, () => {
                console.log(`API + app listening on http://localhost:${PORT} [${app.locals.db.mode === 'remote' ? 'MongoDB' : 'in-memory demo DB'}]`);
            });
            const shutdown = async () => {
                server.close();
                await app.locals.db.disconnect();
                process.exit(0);
            };
            process.on('SIGINT', shutdown);
            process.on('SIGTERM', shutdown);
        })
        .catch(err => {
            console.error('Failed to start server:', err);
            process.exit(1);
        });
}
