import jsPDF from 'jspdf';

// 1. Defines the structure for the invoice items
interface InvoiceItem {
    sno: number;
    name: string;
    hsn: string;
    quantity: number;
    unit: string;
    listPrice: number;
    gstPercent: number;
    discountAmount: number;
}

// 2. Defines the structure for the entire invoice data object
interface InvoiceData {
    companyName: string;
    companyAddress: string;
    companyContact: string;
    companyEmail: string;

    billTo: {
        name: string;
        address: string;
        phone: string;
    };

    invoice: {
        number: string;
        date: string;
        billedBy: string;
    };

    items: InvoiceItem[];

    paymentInfo: {
        account: string;
        accountName: string;
        bankDetails: string;
        gstin: string;
    };

    terms: string;
}


export const generatePdf = (data: InvoiceData) => {
    // Guard clause to prevent crashes if the entire data object is missing
    if (!data) {
        console.error("generatePdf was called with invalid data. Aborting PDF generation.");
        return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let y = 25;

    // Define colors and styles based on Image 1
    const primaryColor = '#002060'; // Dark Blue for header, footer background
    const headerTextColor = '#FFFFFF'; // White for header text on blue background
    const bodyTextColor = '#333333'; // Dark Gray for most body text
    const tableHeaderBg = '#F2F2F2'; // Light Gray for table header background
    const tableLineColor = '#DDDDDD'; // Light gray for table borders

    // Outer border (Dark Blue)
    doc.setDrawColor(primaryColor);
    doc.setLineWidth(2); // Thicker border
    doc.rect(2, 2, pageWidth - 4, pageHeight - 4);

    // === 1. HEADER (Company Name and Info) ===
    doc.setFillColor(primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F'); // Blue rectangle for the top header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(headerTextColor); // White text for header
    doc.text(data.companyName || 'Giftinguru.com', pageWidth / 2, 25, { align: 'center' });
    y = 50; // Start content below the blue header

    // === 2. BILLING & INVOICE INFO (Two-column layout) ===
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(bodyTextColor); // Dark gray for body text

    const leftColX = margin;
    const rightColX = pageWidth / 2 + 10;
    const initialY = y;

    // Left Column: Bill To
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To', leftColX, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    // Ensure all billTo fields have fallbacks
    const billToAddress = doc.splitTextToSize(
        `${data.billTo?.name || 'Customer Name'}\n${data.billTo?.address || 'Customer Address'}\n${data.billTo?.phone || 'N/A'}`,
        (pageWidth / 2) - margin - 5
    );
    doc.text(billToAddress, leftColX, y);
    const leftHeight = y + billToAddress.length * 5;

    // Right Column: Invoice Details
    y = initialY; // Reset y for the right column
    doc.setFont('helvetica', 'bold');
    doc.text('Invoice No.', rightColX, y);
    doc.text('Date', rightColX, y + 6);
    doc.text('Billed By', rightColX, y + 12);

    doc.setFont('helvetica', 'normal');
    doc.text(data.invoice?.number || 'N/A', rightColX + 30, y);
    doc.text(data.invoice?.date || 'N/A', rightColX + 30, y + 6);
    doc.text(data.invoice?.billedBy || 'N/A', rightColX + 30, y + 12);
    const rightHeight = y + 18;

    // Set y to the bottom of the taller column
    y = Math.max(leftHeight, rightHeight) + 15; // Increased space after this section

    // === 3. ITEMS TABLE ===
    const tableHeaders = ['S. No.', 'Product', 'HSN/SAC', 'Qty.', 'Unit', 'List Price', 'GST (%)', 'Disc. Amt.', 'Amount'];
    const colWidths = [15, 45, 20, 15, 15, 20, 18, 20, 22]; // Adjusting widths to match image
    let currentX = margin;

    // Draw table header
    doc.setFillColor(tableHeaderBg);
    doc.rect(margin, y, pageWidth - 2 * margin, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(bodyTextColor); // Table header text color
    tableHeaders.forEach((header, i) => {
        doc.text(header, currentX + 2, y + 6);
        currentX += colWidths[i];
    });
    y += 8;

    // Draw table rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9); // Smaller font for table content
    doc.setLineWidth(0.1);
    doc.setDrawColor(tableLineColor); // Light gray lines for table
    doc.setTextColor(bodyTextColor);

    // Draw top line of the first row
    doc.line(margin, y, pageWidth - margin, y);

    (data.items || []).forEach(item => {
        const listPrice = item.listPrice || 0;
        const quantity = item.quantity || 0;
        const discountAmount = item.discountAmount || 0;
        const itemAmount = (listPrice * quantity) - discountAmount;

        const rowData = [
            (item.sno || 0).toString(),
            item.name || 'N/A',
            item.hsn || 'N/A',
            quantity.toFixed(2),
            item.unit || 'Pcs',
            listPrice.toFixed(2),
            `${item.gstPercent || 0}%`,
            discountAmount.toFixed(2),
            itemAmount.toFixed(2)
        ];

        currentX = margin;
        rowData.forEach((text, i) => {
            doc.text(text, currentX + 2, y + 6);
            currentX += colWidths[i];
            // Draw vertical lines between columns
            if (i < rowData.length - 1) { // Don't draw line after the last column
                doc.line(currentX, y, currentX, y + 8);
            }
        });
        doc.line(margin, y + 8, pageWidth - margin, y + 8); // Horizontal line after each row
        y += 8;
    });

    // === 4. GRAND TOTAL ===
    const grandTotal = (data.items || []).reduce((sum, item) => {
        const price = item.listPrice || 0;
        const qty = item.quantity || 0;
        const disc = item.discountAmount || 0;
        return sum + (price * qty) - disc;
    }, 0);

    // Grand Total section background
    doc.setFillColor(tableHeaderBg); // Use light gray background
    doc.rect(pageWidth - margin - 80, y, 80, 12, 'F'); // Background for Grand Total line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(bodyTextColor);
    doc.text('GRAND TOTAL', pageWidth - margin - 75, y + 8);
    doc.text(`₹ ${grandTotal.toFixed(2)}`, pageWidth - margin - 5, y + 8, { align: 'right' }); // Align right
    y += 15; // Increased space after total

    // === 5. PAYMENT INFORMATION ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(bodyTextColor);
    doc.text('Payment Information', margin, y);
    doc.setFont('helvetica', 'normal');
    y += 6;
    doc.text(`Account: ${data.paymentInfo?.account || 'N/A'}`, margin, y);
    doc.text(`Bank Details: ${data.paymentInfo?.bankDetails || 'N/A'}`, pageWidth / 2 + 5, y); // Adjusted X for alignment
    y += 6;
    doc.text(`Account Name: ${data.paymentInfo?.accountName || 'N/A'}`, margin, y);
    doc.text(`GSTIN: ${data.paymentInfo?.gstin || 'N/A'}`, pageWidth / 2 + 5, y); // Adjusted X for alignment
    y += 15;

    // === 6. TERMS & CONDITIONS ===
    doc.setFont('helvetica', 'bold');
    doc.text('Terms & Conditions', margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    const termsLines = doc.splitTextToSize(data.terms || 'No terms specified.', pageWidth - 2 * margin);
    doc.text(termsLines, margin, y);
    y += termsLines.length * 3 + 20;

    // === 7. AUTHORISED SIGN ===
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(bodyTextColor);
    doc.line(pageWidth - margin - 60, y, pageWidth - margin, y);
    y += 5;
    doc.text('Authorised Sign', pageWidth - margin - 30, y, { align: 'center' }); // Centered under the line
    y += 10;

    // === 8. FOOTER ===
    const footerHeight = 25; // Adjusted height for footer content
    doc.setFillColor(primaryColor);
    doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F');
    doc.setFontSize(9);
    doc.setTextColor(headerTextColor); // White text for footer

    // Ensure all footer data has fallbacks
    const companyAddress = data.companyAddress || 'Shop no. 59, Gaur Siddhartham, Siddharth Vihar, Ghaziabad - 201009';
    const companyEmail = data.companyEmail || 'giftingurusiddharthvihar@gmail.com';
    const companyContact = data.companyContact || '+91 9625796622';

    doc.text(companyAddress, margin, pageHeight - 15);
    doc.text(companyEmail, pageWidth / 2, pageHeight - 15, { align: 'center' });
    doc.text(`Contact No. - ${companyContact}`, pageWidth - margin, pageHeight - 15, { align: 'right' });
    doc.text('Generated through SELLAR', pageWidth / 2, pageHeight - 7, { align: 'center' }); // Added "Generated through SELLAR"

    // === SAVE THE PDF ===
    doc.save(`invoice_${data.invoice?.number || 'download'}.pdf`);
};