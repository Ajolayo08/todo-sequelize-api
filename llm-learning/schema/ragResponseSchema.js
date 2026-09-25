// schemas/ragResponseSchema.js
const { z } = require('zod');

const RAGResponseSchema = z.object({
    answer: z.string().describe("The direct, helpful answer to the user's prompt"),
    confidenceScore: z.number().min(0).max(1).describe("Confidence from 0.0 to 1.0"),
    sourcesUsed: z.array(z.string()).describe("List of vector document IDs used"),
    requiresHumanReview: z.boolean().describe("True if answer confidence is below 0.6"),
});

module.exports = { RAGResponseSchema };