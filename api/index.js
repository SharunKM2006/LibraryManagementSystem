// Vercel serverless entry point: builds the Express app once per warm lambda
// and forwards every routed request to it.
const createApp = require('../app');

let ready = null;

module.exports = async (req, res) => {
    if (!ready) {
        ready = createApp().catch(err => {
            ready = null; // allow retry on next invocation
            throw err;
        });
    }
    const app = await ready;
    return app(req, res);
};
