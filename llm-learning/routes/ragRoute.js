// routes/ragRoute.js
const express = require('express');
const router = express.Router();
const { OpenAI } = require('openai');
const { indexDocument, searchSimilarDocuments } = require('../services/vectorService');
const { tools, executeToolCall } = require('../services/toolService');
const { runAutonomousAgent } = require('../services/agentService');
const { clearSessionHistory } = require('../services/memoryService');
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const { logMetric } = require('../logger');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Express RAG App',
    },
});

/**
 * @openapi
 * /api/index:
 *   post:
 *     summary: Index a new document into vector storage
 *     tags:
 *       - RAG Vector Operations
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - text
 *             properties:
 *               id:
 *                 type: string
 *                 example: info-1
 *               text:
 *                 type: string
 *                 example: Glorious has a sister named Gift
 *     responses:
 *       200:
 *         description: Document indexed successfully
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Internal Server Error
 */
router.post('/index', async (req, res, next) => {
    try {
        const { id, text } = req.body;
        if (!id || !text) {
            return res.status(400).json({ success: false, error: 'id and text are required' });
        }
        const doc = await indexDocument(id, text);
        return res.status(200).json({ success: true, indexed: { id: doc.id, text: doc.text } });
        // throw new Error('Test Error: Global handler works'); // Uncomment to test error handling
    } catch (error) {
        next(error);
    }
});

// Endpoint 2: Retrieve top matching documents for a search query
router.post('/search', async (req, res, next) => {
    try {
        const { query, topK } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, error: 'query string is required' });
        }

        const matches = await searchSimilarDocuments(query, topK || 2);
        return res.status(200).json({ success: true, query, results: matches });
    } catch (error) {
        next(error);
    }
});


router.post('/agent', async (req, res, next) => {
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
        next(error);
    }
});

// Endpoint 4: ReAct Autonomous Agent Loop
router.post('/agent/react', async (req, res, next) => {
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
        next(error);
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

router.get('/stream-test', (req, res) => {
    // 1. Tell the browser this is an event stream, not a standard JSON response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Flush headers to establish the open connection immediately
    res.flushHeaders();

    // 2. Simulate an AI generating words over time
    const words = ["Hello", "Glorious!", "This", "is", "your", "first", "real-time", "SSE", "stream."];
    let index = 0;

    // Send one word every 500ms
    const intervalId = setInterval(() => {
        if (index < words.length) {
            // Remember the SSE rule: data: <payload>\n\n
            const payload = JSON.stringify({ token: words[index] });
            res.write(`data: ${payload}\n\n`);
            index++;
        } else {
            // Stream is finished: Send a completion marker and close the connection
            res.write(`data: [DONE]\n\n`);
            clearInterval(intervalId);
            res.end(); // Closes the HTTP connection cleanly
        }
    }, 500);

    // 3. Clean up if the user closes the tab before the stream finishes
    req.on('close', () => {
        clearInterval(intervalId);
        res.end();
    });
});

/**
 * @openapi
 * /api/stream-ai:
 *   get:
 *     summary: Stream real-time AI response from Gemini using SSE
 *     produces:
 *       - text/event-stream
 *     responses:
 *       200:
 *         description: SSE AI text stream
 */
router.get('/stream-ai', async (req, res) => {
    // 1. Mandatory SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const prompt = req.query.prompt || "Tell me a short joke.";

    // List of active models for automatic fallback
    const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash-lite'];

    let responseStream = null;
    let lastError = null;

    // Try models sequentially until a connection opens
    for (const modelName of modelsToTry) {
        try {
            responseStream = await ai.models.generateContentStream({
                model: modelName,
                contents: prompt,
            });
            break;
        } catch (err) {
            lastError = err;
            console.warn(`Model ${modelName} unavailable: ${err.message}. Retrying fallback...`);
        }
    }

    // Handle case where all models fail
    if (!responseStream) {
        const errorMessage = lastError?.message || 'All AI models are currently busy. Please try again.';
        res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
        return res.end();
    }

    try {
        // 2. Stream chunks to browser as they arrive
        for await (const chunk of responseStream) {
            if (chunk.text) {
                res.write(`${JSON.stringify({ text: chunk.text })}\n`);
            }
        }

        // 3. Signal stream completion
        res.write(`data: [DONE]\n\n`);
        res.end();

    } catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message || 'Stream interrupted' })}\n\n`);
        res.end();
    }
});
module.exports = router; 