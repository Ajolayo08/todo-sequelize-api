// server.js
const express = require('express');
require('dotenv').config();
const setupSwagger = require('./swagger');
const { handleRAGQuery } = require('./ragController');
const ragRoute = require('./routes/ragRoute');

const app = express();
setupSwagger(app);
const PORT = process.env.PORT || 3000;
const errorHandler = require('../errorHandler');

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

app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 RAG API Server running on http://localhost:${PORT}`);
});