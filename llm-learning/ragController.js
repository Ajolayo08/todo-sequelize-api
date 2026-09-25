// controllers/ragController.js
const { queryRAG } = require('./ragService');
// Express controller function to validate an incoming payload with an array of text strings and return their embeddings

async function handleRAGQuery(req, res) {
    try {
        const { question } = req.body;

        if (!question || typeof question !== 'string' || !question.trim()) {
            return res.status(400).json({
                success: false,
                error: "Field 'question' is required and must be a non-empty string."
            });
        }

        const result = await queryRAG(question.trim());

        return res.status(200).json({
            success: true,
            question: question.trim(),
            answer: result.answer,
            context: result.contextRetrieved
        });

    } catch (error) {
        console.error("❌ API RAG Error:", error.message);
        return res.status(500).json({
            success: false,
            error: "An internal server error occurred while processing the RAG request."
        });
    }
}

module.exports = { handleRAGQuery };