const https = require('https');
const axios = require('axios');
const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

// Create custom HTTPS Agent to prevent socket drops
const agent = new https.Agent({
    rejectUnauthorized: true,
    keepAlive: false, // Don't reuse sockets that might get cut off
});

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

async function main() {
    console.log('🌲 Checking Pinecone Index status...');

    // 1. Ensure index exists
    const existingIndexes = await pc.listIndexes();
    const indexExists = existingIndexes.indexes?.some((idx) => idx.name === INDEX_NAME);

    if (!indexExists) {
        console.log(`Creating index "${INDEX_NAME}" (3072 dims)...`);
        await pc.createIndex({
            name: INDEX_NAME,
            dimension: 3072,
            metric: 'cosine',
            spec: {
                serverless: {
                    cloud: 'aws',
                    region: 'us-east-1',
                },
            },
        });
        console.log('⏳ Waiting for index initialization...');
        await new Promise((resolve) => setTimeout(resolve, 10000));
    }

    const index = pc.index(INDEX_NAME);

    // 2. Data to ingest
    const documents = [
        { id: 'doc1', category: 'auth', text: 'Use bcrypt to hash user passwords with salt before storing in DB.' },
        { id: 'doc2', category: 'auth', text: 'JSON Web Tokens (JWT) should be signed with a strong secret key and expire quickly.' },
        { id: 'doc3', category: 'general', text: 'Node.js uses an event-driven, non-blocking I/O model.' },
    ];

    console.log('\n⚡ Generating embeddings & upserting to Pinecone...');

    const records = [];
    for (const doc of documents) {
        const vector = await getEmbedding(doc.text);
        records.push({
            id: doc.id,
            values: vector,
            metadata: {
                text: doc.text,
                category: doc.category,
            },
        });
        console.log(`Prepared vector for [${doc.id}]`);
    }

    // 3. Upsert records into Pinecone
    await index.upsert({ records });
    console.log('\n✅ Successfully stored vectors in Pinecone Database!');
}

main().catch((err) => console.error('❌ Error:', err));