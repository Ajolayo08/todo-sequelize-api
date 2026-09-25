// services/vectorService.js
const { OpenAI } = require('openai');
const { cosineSimilarity } = require('../utils/vectorMath');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
});

// In-Memory Document & Vector Storage
const vectorStore = [];

/**
 * Generates an embedding vector for a given string input.
 */
async function generateEmbedding(text) {
    const response = await openai.embeddings.create({
        model: 'liquid/lfm-2.5-embedding-350m:free', // Free embedding model on OpenRouter
        input: text,
    });

    return response.data[0].embedding;
}

/**
 * Adds raw document text to the in-memory vector store with its embedding.
 */
async function indexDocument(id, text) {
    const embedding = await generateEmbedding(text);
    const doc = { id, text, embedding };
    vectorStore.push(doc);
    return doc;
}

/**
 * Performs Cosine Similarity search over stored document embeddings.
 */
async function searchSimilarDocuments(queryText, topK = 2) {
    if (vectorStore.length === 0) {
        return [];
    }

    const queryEmbedding = await generateEmbedding(queryText);

    // Compute similarity score for each document
    const scoredDocs = vectorStore.map((doc) => ({
        id: doc.id,
        text: doc.text,
        score: cosineSimilarity(queryEmbedding, doc.embedding),
    }));

    // Sort by score descending and take the top K results
    scoredDocs.sort((a, b) => b.score - a.score);
    return scoredDocs.slice(0, topK);
}

module.exports = {
    indexDocument,
    searchSimilarDocuments,
    vectorStore,
};