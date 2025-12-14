const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Ultra Fitness Gym API',
            version: '1.0.0',
            description: 'RESTful API documentation for Ultra Fitness Gym Management System',
            contact: {
                name: 'API Support',
                email: 'support@ultrafitness.com',
            },
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.js', './src/models/*.js'], // Files containing annotations
};

const specs = swaggerJsdoc(options);

module.exports = specs;
