const https = require('https');
const axios = require('axios');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

// Create custom HTTPS Agent to prevent socket drops
const agent = new https.Agent({
    rejectUnauthorized: true,
    keepAlive: false, // Don't reuse sockets that might get cut off
});

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const INDEX_NAME = 'llm-learning-index';

async function getEmbedding(text, retries = 3) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(
                url,
                {
                    model: 'models/gemini-embedding-001',
                    content: { parts: [{ text: text }] },
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    httpsAgent: agent, // Use custom HTTPS agent
                    timeout: 30000,
                }
            );

            return response.data.embedding.values;
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`⚠️ Retry (${i + 1}/${retries})... (${err.message})`);
            await new Promise((res) => setTimeout(res, 2000));
        }
    }
}

async function searchKnowledgeBase(userQuery, topK = 2) {
    console.log(`\n🔎 User Query: "${userQuery}"`);

    console.log('⚡ Generating query vector embedding...');
    const queryVector = await getEmbedding(userQuery);

    const index = pc.index(INDEX_NAME);

    console.log(`🌲 Searching Pinecone for top ${topK} matches...`);
    const queryResponse = await index.query({
        vector: queryVector,
        topK: topK,
        includeMetadata: true,
    });

    console.log('\n🎯 Matches Found:');
    queryResponse.matches.forEach((match, i) => {
        const similarityScore = (match.score * 100).toFixed(2);
        console.log(`\n Match #${i + 1} [Score: ${similarityScore}%]`);
        console.log(`   ID: ${match.id}`);
        console.log(`   Category: ${match.metadata.category}`);
        console.log(`   Text: "${match.metadata.text}"`);
    });
}

async function main() {
    await searchKnowledgeBase('How should I safely store user passwords?');
}

main().catch((err) => console.error('❌ Error:', err));