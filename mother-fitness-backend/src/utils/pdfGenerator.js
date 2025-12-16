const PDFDocument = require('pdfkit');

/**
 * Generate payment receipt PDF
 * @param {Object} payment - Payment object
 * @param {Object} customer - Customer object
 * @returns {PDFDocument} PDF document stream
 */
const generatePaymentReceipt = (payment, customer) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    // Helper to draw horizontal line
    const drawLine = (y) => {
        doc.moveTo(50, y).lineTo(545, y).stroke();
    };

    // 1. Header
    // Note: PDFKit might not support emojis natively in standard fonts. 
    // We'll use a text representation or try to include it if supported, 
    // but for safety in standard PDF fonts, we might omit the emoji or use a simple text header.
    // However, the user asked for "🧾 Mother Fitness PAYMENT RECEIPT".
    // I will use "PAYMENT RECEIPT" with large bold text.

    doc.fontSize(20)
        .font('Helvetica-Bold')
        .text('MOTHER FITNESS PAYMENT RECEIPT', { align: 'center' });

    doc.moveDown(1.5);

    // Current Y position
    let y = doc.y;

    // 2. Member Details
    doc.fontSize(12).font('Helvetica');
    const labelX = 50;
    const valueX = 200;
    const gap = 20;

    doc.text('Member Name:', labelX, y)
        .text(customer.name, valueX, y);
    y += gap;

    doc.text('Member Phone:', labelX, y)
        .text(customer.phone, valueX, y);
    y += gap;

    doc.text('Email:', labelX, y)
        .text(customer.email, valueX, y);
    y += gap;

    doc.text('Member ID:', labelX, y)
        .text(customer.memberId, valueX, y);
    y += gap + 10;

    // Separator
    drawLine(y);
    y += 15;

    // 3. Receipt Details
    doc.font('Helvetica-Bold').text('Receipt Details', labelX, y);
    y += 20;
    doc.font('Helvetica');

    const receiptNo = payment.receiptNumber || payment.paymentId || payment._id.toString().substring(0, 10).toUpperCase();

    doc.text('Receipt No:', labelX, y)
        .text(receiptNo, valueX, y);
    y += gap;

    const paymentDate = new Date(payment.paymentDate);
    doc.text('Date:', labelX, y)
        .text(paymentDate.toLocaleDateString('en-IN'), valueX, y);
    y += gap;

    doc.text('Payment Mode:', labelX, y)
        .text(payment.paymentMethod, valueX, y);
    y += gap + 10;

    // Separator
    drawLine(y);
    y += 15;

    // 4. Package Details
    doc.font('Helvetica-Bold').text('Package Details', labelX, y);
    y += 20;
    doc.font('Helvetica');

    // Calculate duration
    let months = 1;
    if (payment.planType && payment.planType.toLowerCase().includes('quarter')) months = 3;
    if (payment.planType && payment.planType.toLowerCase().includes('half')) months = 6;
    if (payment.planType && payment.planType.toLowerCase().includes('year')) months = 12;

    const endDate = new Date(paymentDate);
    endDate.setMonth(endDate.getMonth() + months);

    doc.text('Package Name:', labelX, y)
        .text(`${payment.planType} Gym Membership`, valueX, y);
    y += gap;

    doc.text('Duration:', labelX, y)
        .text(`${paymentDate.toLocaleDateString('en-IN')}  to  ${endDate.toLocaleDateString('en-IN')}`, valueX, y);
    y += gap + 10;

    // Separator
    drawLine(y);
    y += 15;

    // 5. Payment Summary
    doc.font('Helvetica-Bold').text('Payment Summary', labelX, y);
    y += 30;

    doc.fontSize(14);
    doc.text('Total Paid', labelX, y)
        .text(`₹ ${payment.amount}`, valueX, y);
    y += gap + 20;
    doc.fontSize(12).font('Helvetica');

    // Separator
    drawLine(y);
    y += 15;

    // 6. Terms & Notes
    doc.font('Helvetica-Bold').text('Terms & Notes', labelX, y);
    y += 20;
    doc.font('Helvetica').fontSize(10);

    const terms = [
        'Fees once paid are non-refundable',
        'Membership is non-transferable',
        'Follow gym rules & timings',
        'Lost receipt will not be reissued'
    ];

    terms.forEach(term => {
        doc.text(`• ${term}`, labelX + 10, y);
        y += 15;
    });
    y += 15;

    // Separator
    drawLine(y);
    y += 30;

    // 7. Authorization
    doc.fontSize(12).font('Helvetica-Bold').text('Authorization', labelX, y);
    y += 20;
    doc.font('Helvetica').text('Received By: Mother Fitness Gym Management', labelX, y);

    doc.end();
    return doc;
};

module.exports = {
    generatePaymentReceipt
};
