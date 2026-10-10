const redisClient = require('./redisClient');

async function test() {
    // 1. Set a key in Redis
    await redisClient.set('test_key', 'Hello from Node.js!');
    console.log('Saved data to Redis!');

    // 2. Fetch the key from Redis
    const value = await redisClient.get('test_key');
    console.log('Retrieved from Redis:', value);
}

// Run the test after giving it a second to connect
setTimeout(test, 2000);