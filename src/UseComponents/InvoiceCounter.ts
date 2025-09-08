import { db } from '../lib/firebase'; // Make sure this path is correct
import { doc, runTransaction, DocumentReference } from 'firebase/firestore';

/**
 * Generates the next sequential invoice number atomically.
 * @returns {Promise<string>} The formatted invoice number (e.g., INV-202508-1001).
 */
export const generateNextInvoiceNumber = async (): Promise<string> => {
    const counterRef: DocumentReference = doc(db, 'counters', 'invoiceCounter');

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1001; // Default starting number

            if (counterDoc.exists()) {
                const current = counterDoc.data()?.currentNumber || 1000;
                nextNumber = current + 1;
            }

            transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
            return nextNumber;
        });

        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const paddedNumber = String(newNumber).padStart(4, '0');

        return `INV-${year}${month}-${paddedNumber}`;

    } catch (error) {
        console.error("Error generating invoice number:", error);
        throw new Error("Could not generate a new invoice number.");
    }
};