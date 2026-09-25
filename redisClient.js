require('dotenv').config();
const { createClient } = require('redis');

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on('connect', () => console.log('⚡ Connecting to Redis Cloud...'));
redisClient.on('ready', () => console.log('✅ Connected to Redis Cloud successfully!'));
redisClient.on('error', (err) => console.error('❌ Redis Error:', err));

(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
    }
})();

module.exports = redisClient;