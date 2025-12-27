const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: './.env' });

// Define Minimal Schema for migration to avoid validation errors during load
// We need to access the raw document to fix it, so we might use `findOneAndUpdate` or strict: false
// But using the model is better if we can disable validation for the fetch.
// Actually, `find()` doesn't validate. `save()` does.
const Customer = require('./src/models/Customer');
const Payment = require('./src/models/Payment');

const migrateData = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected.');

        console.log('Starting migration...');

        // 1. Fetch all customers
        const customers = await Customer.find({});
        console.log(`Found ${customers.length} customers.`);

        for (const customer of customers) {
            console.log(`Processing ${customer.memberId} (${customer.name})...`);
            let modified = false;

            // --- MIGRATION LOGIC ---

            // A. Fix membershipStatus Enum
            // Old data might have 'active' (lowercase)
            if (customer.membershipStatus && customer.membershipStatus.toLowerCase() === 'active') {
                customer.membershipStatus = 'ACTIVE';
                modified = true;
            } else if (!customer.membershipStatus) {
                customer.membershipStatus = 'ACTIVE'; // Default
                modified = true;
            }

            // B. Fix Membership Object
            if (!customer.membership || !customer.membership.planId) {
                console.log(`  > Migrating membership data...`);

                // Try to infer from old fields (checking _doc for raw access if needed, but mongoose objects usually expose them)
                // Accessing raw object to find 'plan', 'validity' etc if they exist but are not in schema
                const rawDoc = customer.toObject();

                const planName = rawDoc.plan || 'Monthly';
                const duration = rawDoc.validity || 30; // Default 30 days

                // Keep existing dates or default to now
                const startDate = rawDoc.startDate ? new Date(rawDoc.startDate) : new Date();
                const endDate = rawDoc.endDate ? new Date(rawDoc.endDate) : new Date(startDate.getTime() + (duration * 24 * 60 * 60 * 1000));

                // Infer price (We don't know it, set to 0 or arbitrary default)
                // Existing plan bug said "plan mismatch", so prices might be wacky.
                // Let's set a logical default based on planName if possible? 
                // Or just 0 and let them fix it.
                // User said "planPriceAtPurchase NEVER changes". 
                // We'll set it to 0 for legacy records if unknown.
                const price = 0;

                customer.membership = {
                    planId: 'LEGACY', // Indicate this was migrated
                    planName: planName,
                    durationDays: duration,
                    startDate: startDate,
                    endDate: endDate,
                    planPriceAtPurchase: price
                };
                modified = true;
            }

            // C. Fix Payment Summary
            if (!customer.paymentSummary || !customer.paymentSummary.paymentStatus) {
                console.log(`  > Initializing payment summary...`);
                // Recalculate logic will fix values, but structure needs to exist
                customer.paymentSummary = {
                    totalPaid: 0,
                    balance: customer.membership.planPriceAtPurchase,
                    paymentStatus: 'PENDING'
                };
                modified = true;
            }

            // Save if modified
            if (modified) {
                try {
                    // Bypass mongoose validation if needed? No, we WANT to validate to ensure it's fixed.
                    // But if other fields are broken, it might fail.
                    await customer.save();
                    console.log(`  > Saved.`);
                } catch (err) {
                    console.error(`  > Failed to save ${customer.memberId}:`, err.message);
                    // Force update using findOneAndUpdate to bypass validation if save fails?
                    // await Customer.updateOne({ _id: customer._id }, { $set: { ... } });
                }
            } else {
                console.log(`  > No changes needed.`);
            }
        }

        console.log('Migration complete.');
        process.exit(0);

    } catch (error) {
        console.error('Migration Error:', error);
        process.exit(1);
    }
};

migrateData();
