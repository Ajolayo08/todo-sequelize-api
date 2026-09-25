// services/memoryService.js

// In-memory store mapping sessionId -> array of messages
const sessionStore = new Map();

/**
 * Gets conversation history for a session, or initializes it with a system prompt.
 */
function getSessionHistory(sessionId) {
    if (!sessionStore.has(sessionId)) {
        sessionStore.set(sessionId, [
            {
                role: 'system',
                content: `You are an autonomous agent operating in a ReAct loop.
When given a user prompt:
1. Reason about what tool you need.
2. Execute tools as needed.
3. Review tool observations to decide if you need to call another tool or give a final answer.
Stop calling tools when you have sufficient information to answer fully.`,
            },
        ]);
    }
    return sessionStore.get(sessionId);
}

/**
 * Clears history for a given session.
 */
function clearSessionHistory(sessionId) {
    if (sessionStore.has(sessionId)) {
        sessionStore.delete(sessionId);
        return true;
    }
    return false;
}

module.exports = {
    getSessionHistory,
    clearSessionHistory,
};