const https = require('https');
const axios = require('axios');
require('dotenv').config();

const agent = new https.Agent({
    rejectUnauthorized: true,
    keepAlive: false
});

async function listModels() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`;

    try {
        const response = await axios.get(url, { httpsAgent: agent });
        const models = response.data.models;

        console.log("\n📋 Available Text Generation Models:");
        models.forEach(m => {
            if (m.supportedGenerationMethods.includes("generateContent")) {
                // Strip out the "models/" prefix so we see exact name
                console.log(`- ${m.name}`);
            }
        });
    } catch (err) {
        if (err.response) {
            console.error("API Error:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("Error:", err.message);
        }
    }
}

listModels();