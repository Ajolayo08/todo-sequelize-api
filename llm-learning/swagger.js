const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'AI Agent & Order API',
            version: '1.0.0',
            description: 'Production Express backend with Clean Architecture',
        },
        servers: [
            { url: 'http://localhost:3000' }
        ],
    },
    apis: ['./routes/*.js'], // Scans all route files for docs
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve interactive UI on /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));