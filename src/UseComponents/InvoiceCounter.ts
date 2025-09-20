import { db } from '../lib/firebase';
import { doc, runTransaction, DocumentReference } from 'firebase/firestore';


export const generateNextInvoiceNumber = async (): Promise<string> => {
    const counterRef: DocumentReference = doc(db, 'counters', 'invoiceCounter');

    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNumber = 1001;

            if (counterDoc.exists()) {
                const current = counterDoc.data()?.currentNumber || 1000;
                nextNumber = current + 1;
            }

            transaction.set(counterRef, { currentNumber: nextNumber }, { merge: true });
            return nextNumber;
        });

        const paddedNumber = String(newNumber).padStart(4, '0');

        return `INV-${paddedNumber}`;

    } catch (error) {
        console.error("Error generating invoice number:", error);
        throw new Error("Could not generate a new invoice number.");
    }
};


const COUNTER_DOC_REF = doc(db, 'counter', 'purchaseInvoice');

export const generateNextPurchaseInvoiceNumber = async (): Promise<string> => {
    try {
        const newNumber = await runTransaction(db, async (transaction) => {
            const counterDoc = await transaction.get(COUNTER_DOC_REF);

            if (!counterDoc.exists()) {
                transaction.set(COUNTER_DOC_REF, { lastNumber: 1000 });
                return 1001;
            }

            const lastNumber = counterDoc.data().lastNumber;
            const nextNumber = lastNumber + 1;

            transaction.update(COUNTER_DOC_REF, { lastNumber: nextNumber });

            return nextNumber;
        });

        return `INV-${newNumber}`;

    } catch (error) {
        console.error("Error generating invoice number:", error);
        throw new Error("Could not generate a new invoice number.");
    }
};