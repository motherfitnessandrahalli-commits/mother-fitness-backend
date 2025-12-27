const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Customer = require('../models/Customer');

class PaymentService {
    /**
     * Recalculate payment summary for a member
     * @param {string} memberId - Human readable Member ID (e.g. U010)
     */
    async recalculatePaymentSummary(memberId) {
        console.log(`[PaymentService] Recalculating summary for ${memberId}`);

        try {
            // 1. Get the Member
            const member = await Customer.findOne({ memberId });
            if (!member) {
                console.error(`[PaymentService] Member ${memberId} not found`);
                return;
            }

            // 2. Sum payments for CURRENT MEMBERSHIP CYCLE
            // We only count payments made ON or AFTER the plan start date.
            // This handles renewals: New Start Date -> Old payments ignored -> Balance resets.
            const query = {
                memberId: memberId,
                paymentDate: { $gte: member.membership.startDate }
            };
            const payments = await Payment.find(query);
            const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

            // 3. Calculate Balance & Status
            const planPrice = member.membership.planPriceAtPurchase || 0;
            const balance = Math.max(0, planPrice - totalPaid); // Balance shouldn't be negative usually, unless overpaid

            let paymentStatus = 'PENDING';
            if (totalPaid >= planPrice) {
                paymentStatus = 'COMPLETED';
            } else if (totalPaid > 0) {
                paymentStatus = 'PARTIAL';
            }

            // 4. Update Member
            member.paymentSummary = {
                totalPaid,
                balance,
                paymentStatus
            };

            // This save will trigger the Customer.post('save') hook for Cloud Sync
            await member.save();

            console.log(`[PaymentService] Updated ${memberId}: Paid=${totalPaid}, Bal=${balance}, Status=${paymentStatus}`);

        } catch (error) {
            console.error(`[PaymentService] Error recalculating summary for ${memberId}:`, error);
            throw error;
        }
    }
}

module.exports = new PaymentService();
