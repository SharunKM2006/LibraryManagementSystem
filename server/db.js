// MongoDB connection: uses MONGODB_URI when provided (production / Atlas),
// otherwise boots a local in-memory MongoDB so the app runs out of the box.
const mongoose = require('mongoose');

let memoryServer = null;

async function connectDb() {
    const uri = process.env.MONGODB_URI;
    let mode;

    if (uri) {
        await mongoose.connect(uri);
        mode = 'remote';
        console.log(`Connected to MongoDB at ${uri.replace(/\/\/.*@/, '//***@')}`);
    } else {
        if (process.env.VERCEL) {
            throw new Error('MONGODB_URI is required on Vercel. Set it with `vercel env add MONGODB_URI production`.');
        }
        // Lazy: only needed for local zero-config runs (devDependency).
        const { MongoMemoryServer } = require('mongodb-memory-server');
        memoryServer = await MongoMemoryServer.create();
        await mongoose.connect(memoryServer.getUri('library'));
        mode = 'memory';
        console.log('Started local in-memory MongoDB (set MONGODB_URI for persistence)');
    }

    return {
        mode,
        async disconnect() {
            await mongoose.disconnect();
            if (memoryServer) await memoryServer.stop();
        }
    };
}

module.exports = { connectDb };
