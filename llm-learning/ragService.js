// services/ragService.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // Bypass WARP/TLS issues

const https = require('https');
const axios = require('axios');
const { Pinecone } = require('@pinecone-database/pinecone');

const agent = new https.Agent({
    rejectUnauthorized: true,
    keepAlive: false
});

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index('llm-learning-index');

// Helper 1: Embed Query
async function getEmbedding(text) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await axios.post(
        url,
        {
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] }
        },
        { headers: { 'Content-Type': 'application/json' }, httpsAgent: agent }
    );

    return response.data.embedding.values;
}

// Helper 2: Retrieve Context from Pinecone
async function getContextFromPinecone(queryVector) {
    const queryResponse = await index.query({
        vector: queryVector,
        topK: 2,
        includeMetadata: true
    });

    return queryResponse.matches
        .map(match => match.metadata?.text || match.metadata?.content || '')
        .filter(Boolean)
        .join('\n- ');
}

// Helper 3: Synthesize Answer via Gemini
async function generateAnswer(query, context) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const prompt = `
You are a helpful assistant. Answer the user's question strictly based on the context provided below.
If the answer cannot be found, say "I don't have enough information in my database."

---
CONTEXT:
${context}
---

USER QUESTION:
${query}
`;

    const response = await axios.post(
        url,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' }, httpsAgent: agent }
    );

    return response.data.candidates[0].content.parts[0].text;
}

// Main Pipeline Function
async function queryRAG(userQuestion) {
    const embedding = await getEmbedding(userQuestion);
    const context = await getContextFromPinecone(embedding);

    if (!context) {
        return {
            answer: "I don't have enough information in my database.",
            contextRetrieved: []
        };
    }

    const answer = await generateAnswer(userQuestion, context);

    return {
        answer,
        contextRetrieved: context.split('\n- ')
    };
}

module.exports = { queryRAG };