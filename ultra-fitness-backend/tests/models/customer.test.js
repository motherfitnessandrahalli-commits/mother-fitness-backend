const mongoose = require('mongoose');
const Customer = require('../../src/models/Customer');

describe('Customer Model Test', () => {
    afterEach(async () => {
        await Customer.deleteMany({});
    });

    it('should create & save customer successfully', async () => {
        const customerData = {
            name: 'John Doe',
            age: 30,
            email: 'john@example.com',
            phone: '1234567890',
            plan: 'Monthly',
            validity: new Date(),
            createdBy: new mongoose.Types.ObjectId()
        };
        const validCustomer = new Customer(customerData);
        const savedCustomer = await validCustomer.save();

        expect(savedCustomer._id).toBeDefined();
        expect(savedCustomer.customerId).toBeDefined(); // Auto-generated
        expect(savedCustomer.name).toBe(customerData.name);
    });

    it('should calculate status correctly', () => {
        const customer = new Customer({
            name: 'Jane Doe',
            validity: new Date(Date.now() + 86400000 * 10) // 10 days from now
        });
        expect(customer.status).toBe('active');

        const expiringCustomer = new Customer({
            name: 'Jane Doe',
            validity: new Date(Date.now() + 86400000 * 2) // 2 days from now
        });
        expect(expiringCustomer.status).toBe('expiring');

        const expiredCustomer = new Customer({
            name: 'Jane Doe',
            validity: new Date(Date.now() - 86400000) // Yesterday
        });
        expect(expiredCustomer.status).toBe('expired');
    });
});
