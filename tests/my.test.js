const request = require('supertest');
const app = require('../app'); // Import your Express app instance

describe('Todo API Endpoints', () => {

    // Test 1: Check if the server responds on a basic route
    it('GET / should return 200 OK', async () => {
        const response = await request(app).get('/');

        expect(response.statusCode).toBe(200);
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

        // Assertions (Checking the results)
        expect(response.statusCode).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.title).toBe('Study Jest Testing');
    });

});