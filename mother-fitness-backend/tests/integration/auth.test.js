const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/User');

let token;

describe('Auth API Test', () => {
    // Cleanup before tests
    beforeAll(async () => {
        await User.deleteMany({});
    });

    it('should register a new user', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Test Admin',
                email: 'admin@test.com',
                password: 'password123',
                role: 'admin'
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.data).toHaveProperty('token');
        token = res.body.data.token;
    });

    it('should login user', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'admin@test.com',
                password: 'password123'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.data).toHaveProperty('token');
    });

    it('should get current user profile', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.data.user.email).toBe('admin@test.com');
    });
});
