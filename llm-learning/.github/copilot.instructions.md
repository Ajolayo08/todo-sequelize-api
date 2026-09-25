# Project Rules & Architecture Standards

## Stack & Environment
- Runtime: Node.js (CommonJS `require` syntax)
- Framework: Express.js
- Vector Database: Pinecone
- LLM Provider: Google Gemini API (@google/genai or @google/generative-ai)

## Coding Standards
- Use `async/await` for asynchronous code instead of raw promises or callbacks.
- Wrap controller functions in `try...catch` blocks with explicit status codes (e.g., 400 for bad input, 500 for server errors).
- Clean up incoming user input (e.g., `.trim()`) before passing it to vector or embedding services.
- Never hardcode secrets or API keys. Always access variables via `process.env`.