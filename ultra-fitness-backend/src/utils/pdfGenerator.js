const PDFDocument = require('pdfkit');

/**
 * Generate payment receipt PDF
 * @param {Object} payment - Payment object
 * @param {Object} customer - Customer object
 * @returns {PDFDocument} PDF document stream
 */
const generatePaymentReceipt = (payment, customer) => {
    const doc = new PDFDocument({ margin: 50 });

    // Header with gym name
    doc.fontSize(24)
        .font('Helvetica-Bold')
        .text('ULTRA FITNESS GYM', { align: 'center' })
        .moveDown(0.5);

    doc.fontSize(10)
        .font('Helvetica')
        .text('Payment Receipt', { align: 'center' })
        .moveDown(1.5);

    // Receipt info box
    doc.fontSize(10)
        .text(`Receipt #: ${payment._id}`, 50, 150)
        .text(`Date: ${new Date(payment.paymentDate).toLocaleDateString()}`, 50, 165)
        .moveDown(2);

    // Customer info
    doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('BILL TO:', 50, 200);

    doc.fontSize(10)
        .font('Helvetica')
        .text(customer.name, 50, 220)
        .text(`Member ID: ${customer.memberId}`, 50, 235)
        .text(`Email: ${customer.email}`, 50, 250)
        .text(`Phone: ${customer.phone}`, 50, 265)
        .moveDown(2);

    // Payment details table
    const tableTop = 310;

    doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('PAYMENT DETAILS', 50, tableTop);

    // Table headers
    doc.fontSize(10)
        .font('Helvetica-Bold')
        .text('Description', 50, tableTop + 30)
        .text('Plan Type', 250, tableTop + 30)
        .text('Amount', 450, tableTop + 30);

    // Horizontal line
    doc.moveTo(50, tableTop + 45)
        .lineTo(550, tableTop + 45)
        .stroke();

    // Table row
    doc.fontSize(10)
        .font('Helvetica')
        .text('Membership Fee', 50, tableTop + 55)
        .text(payment.planType || 'N/A', 250, tableTop + 55)
        .text(`₹${payment.amount}`, 450, tableTop + 55);

    // Total section
    doc.moveTo(50, tableTop + 85)
        .lineTo(550, tableTop + 85)
        .stroke();

    doc.fontSize(12)
        .font('Helvetica-Bold')
        .text('TOTAL PAID:', 350, tableTop + 95)
        .text(`₹${payment.amount}`, 450, tableTop + 95);

    // Payment method
    doc.fontSize(10)
        .font('Helvetica')
        .text(`Payment Method: ${payment.paymentMethod || 'Cash'}`, 50, tableTop + 130)
        .moveDown(3);

    // Footer
    doc.fontSize(9)
        .font('Helvetica-Oblique')
        .text('Thank you for your payment!', 50, 650, { align: 'center' })
        .text('Ultra Fitness Gym', { align: 'center' })
        .text('For any queries, contact us at support@ultrafitness.com', { align: 'center' });

    // Finalize PDF
    doc.end();

    return doc;
};

module.exports = {
    generatePaymentReceipt
};
