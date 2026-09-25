// routes/ragRoute.js
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { indexDocument, searchSimilarDocuments } = require('../services/vectorService');
const { tools, executeToolCall } = require('../services/toolService');
const { runAutonomousAgent } = require('../services/agentService');
const { clearSessionHistory } = require('../services/memoryService');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Express RAG App',
    },
});

// Endpoint 1: Index a new document into vector storage
router.post('/index', async (req, res) => {
    try {
        const { id, text } = req.body;
        if (!id || !text) {
            return res.status(400).json({ success: false, error: 'id and text are required' });
        }

        const doc = await indexDocument(id, text);
        return res.status(200).json({ success: true, indexed: { id: doc.id, text: doc.text } });
    } catch (error) {
        console.error('Indexing error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint 2: Retrieve top matching documents for a search query
router.post('/search', async (req, res) => {
    try {
        const { query, topK } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, error: 'query string is required' });
        }

        const matches = await searchSimilarDocuments(query, topK || 2);
        return res.status(200).json({ success: true, query, results: matches });
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});


router.post('/agent', async (req, res) => {
    try {
        const { userPrompt } = req.body;
        if (!userPrompt) {
            return res.status(400).json({ success: false, error: 'userPrompt is required' });
        }

        const messages = [
            { role: 'system', content: 'You are an intelligent assistant with access to local tools.' },
            { role: 'user', content: userPrompt },
        ];

        // Initial call sending tool definitions
        let response = await openai.chat.completions.create({
            model: 'openrouter/free',
            messages: messages,
            tools: tools,
            tool_choice: 'auto',
        });

        let responseMessage = response.choices[0].message;

        // Check if model decided to call a tool
        if (responseMessage.tool_calls) {
            messages.push(responseMessage); // Add assistant's tool call request to history

            for (const toolCall of responseMessage.tool_calls) {
                console.log(`🤖 Agent requested tool: ${toolCall.function.name}`);

                // Execute the requested tool locally
                const toolResult = await executeToolCall(toolCall);

                // Append the tool result to the conversation
                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult,
                });
            }

            // Final call to model with tool results included in history
            const finalResponse = await openai.chat.completions.create({
                model: 'openrouter/free',
                messages: messages,
            });

            return res.status(200).json({
                success: true,
                toolUsed: responseMessage.tool_calls[0].function.name,
                finalAnswer: finalResponse.choices[0].message.content,
            });
        }

        // Direct response if no tool call was needed
        return res.status(200).json({
            success: true,
            toolUsed: null,
            finalAnswer: responseMessage.content,
        });
    } catch (error) {
        console.error('Agent error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint 4: ReAct Autonomous Agent Loop
router.post('/agent/react', async (req, res) => {
    try {
        const { userPrompt, sessionId, maxSteps } = req.body;
        if (!userPrompt) {
            return res.status(400).json({ success: false, error: 'userPrompt is required' });
        }

        const result = await runAutonomousAgent(userPrompt, sessionId || 'default-session', maxSteps || 5);

        return res.status(200).json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('ReAct Agent error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

router.post('/agent/clear-session', (req, res) => {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
    }

    const cleared = clearSessionHistory(sessionId);
    return res.status(200).json({
        success: true,
        message: cleared
            ? `Session '${sessionId}' memory cleared.`
            : `Session '${sessionId}' was not found or already empty.`,
    });
});

module.exports = router; 