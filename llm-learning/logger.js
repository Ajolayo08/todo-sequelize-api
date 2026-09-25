// logger.js
function logMetric(phase, details) {
    const timestamp = new Date().toISOString();
    const parts = Object.entries(details)
        .map(([key, val]) => `${key}=${val}`)
        .join(' ');
    console.log(`[${timestamp}] RAG phase=${phase} ${parts}`);
}

module.exports = { logMetric };