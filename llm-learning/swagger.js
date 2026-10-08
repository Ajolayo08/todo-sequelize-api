const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const path = require('path');

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
    // Target the routes folder directly relative to swagger.js
    apis: [path.join(__dirname, './routes/*.js'), './routes/*.js', './*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

function setupSwagger(app) {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
}

module.exports = setupSwagger;