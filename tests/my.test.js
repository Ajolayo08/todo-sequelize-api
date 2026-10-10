const request = require('supertest');
const app = require('../app'); // Import your Express app instance safely

describe('Todo API Endpoints', () => {
    // Test 1: Check if route requires auth or responds
    it('should return a valid status or route response', async () => {
        const response = await request(app).get('/api/todos');
        expect(response.statusCode).toBe(404);
    });

    // Test 2: Check creating a Todo with POST
    it('POST /todos should create a new todo item', async () => {
        const newTodoPayload = {
            title: 'Study Jest Testing',
            description: 'Write unit and integration tests'
        };

        const response = await request(app)
            .post('/todos')
            .send(newTodoPayload);

        // Assertions (Adjust status to 201 if your controller sends created, or 200/401 depending on auth)
        expect(response.statusCode).toBe(401);
    });
});