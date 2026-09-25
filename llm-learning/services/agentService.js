// services/agentService.js
const { OpenAI } = require('openai');
const { tools, executeToolCall } = require('./toolService');
const { getSessionHistory } = require('./memoryService');

const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Express RAG App',
    },
});

async function runAutonomousAgent(userPrompt, sessionId = 'default-session', maxSteps = 5) {
    // Guardrail 1: Restrict max steps to prevent runaway loops / API bill spikes
    const SAFE_MAX_STEPS = Math.min(maxSteps, 5);

    const messages = getSessionHistory(sessionId);

    // Guardrail 2: Context window management (Keep system prompt + last 10 messages)
    if (messages.length > 11) {
        const systemPrompt = messages[0];
        const recentMessages = messages.slice(-10);
        messages.length = 0;
        messages.push(systemPrompt, ...recentMessages);
    }

    messages.push({ role: 'user', content: userPrompt });
    const executionLog = [];

    for (let step = 1; step <= SAFE_MAX_STEPS; step++) {
        console.log(`\n--- Session [${sessionId}] | ReAct Step ${step}/${SAFE_MAX_STEPS} ---`);

        try {
            const response = await openai.chat.completions.create({
                model: 'openrouter/free',
                messages: messages,
                tools: tools,
                tool_choice: 'auto',
            });

            const responseMessage = response.choices[0].message;
            messages.push(responseMessage);

            // Terminal condition: No more tools requested
            if (!responseMessage.tool_calls || responseMessage.tool_calls.length === 0) {
                return {
                    sessionId,
                    completedInSteps: step,
                    finalAnswer: responseMessage.content,
                    executionLog,
                };
            }

            // Execute requested tools
            for (const toolCall of responseMessage.tool_calls) {
                const toolName = toolCall.function.name;
                console.log(`🤖 Step ${step} Tool Call: ${toolName}`);

                let toolResult;
                try {
                    toolResult = await executeToolCall(toolCall);
                } catch (execError) {
                    // Guardrail 3: Safe execution fallback so bad tool calls don't crash the server
                    toolResult = JSON.stringify({
                        error: true,
                        message: `Tool execution failed: ${execError.message}`,
                    });
                }

                executionLog.push({
                    step,
                    tool: toolName,
                    args: JSON.parse(toolCall.function.arguments),
                    output: JSON.parse(toolResult),
                });

                messages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    content: toolResult,
                });
            }
        } catch (apiError) {
            console.error(`API Error on Step ${step}:`, apiError.message);
            return {
                sessionId,
                completedInSteps: step,
                finalAnswer: `Agent execution interrupted due to model service error: ${apiError.message}`,
                executionLog,
            };
        }
    }

    return {
        sessionId,
        completedInSteps: SAFE_MAX_STEPS,
        finalAnswer: 'Reached maximum loop iterations without a conclusive answer.',
        executionLog,
    };
}

module.exports = { runAutonomousAgent };