// Disable strict TLS validation for native fetch (fixes Pinecone behind WARP/VPN)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // <-- ADD THIS LINE FIRST

const https = require('https');
const axios = require('axios');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();
const logger = require('./services/loggerService');


// HTTPS Agent for network stability over WARP
const agent = new https.Agent({
    rejectUnauthorized: true,
    keepAlive: false
});

// Pinecone Setup
const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
    fetchApi: (url, init) => {
        return fetch(url, {
            ...init,
            headers: {
                ...(init && init.headers),
                'Connection': 'close'
            }
        });
    }
});

const INDEX_NAME = 'llm-learning-index';

// Helper: Generate Embedding for Query

async function getEmbedding(text) {
    try {
        logger.info('Incoming embedding request', { text });

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await axios.post(
            url,
            {
                model: "models/gemini-embedding-001",
                content: {
                    parts: [{ text: text }]
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                httpsAgent: agent
            }
        );

        return response.data.embedding.values;
    } catch (err) {
        logger.error('Failed to generate embedding', err.message);
        throw err;
    }
}

// Helper: Generate Final Answer with Gemini using Retrieved Context

async function generateAnswer(query, context) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = `
You are a helpful assistant. Answer the user's question based strictly on the provided context below. 
If the answer cannot be found in the context, say "I don't have enough information in my database."

---
CONTEXT:
${context}
---

USER QUESTION:
${query}
`;

    const response = await axios.post(
        url,
        {
            contents: [{ parts: [{ text: prompt }] }]
        },
        {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent: agent
        }
    );

    return response.data.candidates[0].content.parts[0].text;
}
// Main RAG Pipeline
async function runRAG() {
    const userQuery = "How should I safely store user passwords?";
    console.log(`\n❓ User Question: "${userQuery}"`);

    // 1. Vectorize Query
    console.log("⚡ Step 1: Generating embedding for question...");
    const queryVector = await getEmbedding(userQuery);

    // 2. Query Pinecone
    console.log("🌲 Step 2: Retrieving context from Pinecone...");
    const index = pc.index(INDEX_NAME);
    const searchResults = await index.query({
        vector: queryVector,
        topK: 2,
        includeMetadata: true
    });

    // Extract text from match metadata
    const retrievedContext = searchResults.matches
        .map(match => `- ${match.metadata.text}`)
        .join("\n");

    console.log("\n📚 Context Retrieved from Pinecone:");
    console.log(retrievedContext);

    // 3. Generate Answer
    console.log("\n🤖 Step 3: Sending query + context to Gemini...");
    const answer = await generateAnswer(userQuery, retrievedContext);

    console.log("\n💡 Final AI Response:");
    console.log("=================================");
    console.log(answer);
    console.log("=================================\n");
}

runRAG().catch(console.error);