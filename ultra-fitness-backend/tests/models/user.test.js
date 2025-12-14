const mongoose = require('mongoose');
const User = require('../../src/models/User');

describe('User Model Test', () => {
    // Cleanup after each test
    afterEach(async () => {
        await User.deleteMany({});
    });

    it('should create & save user successfully', async () => {
        const userData = {
            name: 'Test User',
            email: 'test@example.com',
            password: 'password123',
            role: 'staff'
        };
        const validUser = new User(userData);
        const savedUser = await validUser.save();

        expect(savedUser._id).toBeDefined();
        expect(savedUser.name).toBe(userData.name);
        expect(savedUser.email).toBe(userData.email);
        expect(savedUser.password).not.toBe(userData.password); // Should be hashed
    });

    it('should fail to save user without required fields', async () => {
        const userWithoutRequiredField = new User({ name: 'TekLoon' });
        let err;
        try {
            await userWithoutRequiredField.save();
        } catch (error) {
            err = error;
        }
        expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
        expect(err.errors.email).toBeDefined();
    });
});
