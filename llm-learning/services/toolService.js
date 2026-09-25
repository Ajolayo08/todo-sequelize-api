// services/toolService.js
const { searchSimilarDocuments } = require('./vectorService');

// 1. Tool schemas for the OpenAI SDK specification
const tools = [
    {
        type: 'function',
        function: {
            name: 'searchVectorDb',
            description: 'Searches the vector store for relevant documentation based on a user query.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search query to match against stored documents.',
                    },
                    topK: {
                        type: 'integer',
                        description: 'Number of top matching documents to return.',
                        default: 2,
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'writeLogToLogger',
            description: 'Logs important audit events or execution status to the server log.',
            parameters: {
                type: 'object',
                properties: {
                    level: {
                        type: 'string',
                        enum: ['info', 'warn', 'error'],
                        description: 'The severity level of the log.',
                    },
                    message: {
                        type: 'string',
                        description: 'The message content to log.',
                    },
                },
                required: ['level', 'message'],
            },
        },
    },
];

// 2. Local execution mapping
async function executeToolCall(toolCall) {
    const functionName = toolCall.function.name;
    const args = JSON.parse(toolCall.function.arguments);

    if (functionName === 'searchVectorDb') {
        const results = await searchSimilarDocuments(args.query, args.topK || 2);
        return JSON.stringify(results);
    }

    if (functionName === 'writeLogToLogger') {
        console.log(`[AGENT LOG - ${args.level.toUpperCase()}]: ${args.message}`);
        return JSON.stringify({ success: true, logged: args.message });
    }

    throw new Error(`Unknown tool: ${functionName}`);
}

module.exports = {
    tools,
    executeToolCall,
};