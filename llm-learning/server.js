// server.js
const express = require('express');
require('dotenv').config();

const { handleRAGQuery } = require('./ragController');
const ragRoute = require('./routes/ragRoute');
const ragResponseSchema = require('./schema/ragResponseSchema');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use('/api', ragRoute);

// RAG Endpoint
app.post('/api/v1/rag/ask', handleRAGQuery);

// RAG Stats Endpoint
app.get('/api/v1/rag/stats', (req, res) => {
    res.status(200).json({ totalQueries: 42, lastQueryTime: new Date() });
});

// Health Check
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date() });
});

app.listen(PORT, () => {
    console.log(`🚀 RAG API Server running on http://localhost:${PORT}`);
});