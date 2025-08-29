// src/components/PaymentDrawer.tsx

import React, { useState, useEffect, useMemo } from 'react';
import type { PaymentDetails } from '../constants/models'; // Adjust path as needed

// --- Component-Specific Interfaces ---
export interface PaymentCompletionData {
    paymentDetails: PaymentDetails;
    partyName: string;
    partyNumber: string;
    discount: number;
    finalAmount: number;
}

interface PaymentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    onPaymentComplete: (data: PaymentCompletionData) => Promise<void>;
}

// --- Internal Helper Components ---
const Modal: React.FC<{ message: string; onClose: () => void; type: 'success' | 'error' | 'info'; }> = ({ message, onClose, type }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${type === 'success' ? 'bg-green-100' : type === 'error' ? 'bg-red-100' : 'bg-blue-100'}`}>
                {type === 'success' && <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
                {type === 'error' && <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>}
                {type === 'info' && <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <p className="text-lg font-medium text-gray-800 mb-4">{message}</p>
            <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">OK</button>
        </div>
    </div>
);


// --- Main PaymentDrawer Component ---
const PaymentDrawer: React.FC<PaymentDrawerProps> = ({ isOpen, onClose, subtotal, onPaymentComplete }) => {
    const [partyName, setPartyName] = useState('');
    const [partyNumber, setPartyNumber] = useState('');
    const [discount, setDiscount] = useState(0);
    const [selectedPayments, setSelectedPayments] = useState<PaymentDetails>({});
    const [modal, setModal] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDiscountLocked, setIsDiscountLocked] = useState(true);

    const finalPayableAmount = useMemo(() => Math.max(0, subtotal - (subtotal * (discount / 100))), [subtotal, discount]);
    const totalEnteredAmount = useMemo(() => Object.values(selectedPayments).reduce((sum, amount) => sum + (amount || 0), 0), [selectedPayments]);
    const remainingAmount = useMemo(() => finalPayableAmount - totalEnteredAmount, [finalPayableAmount, totalEnteredAmount]);

    const transactionModes = [
        { id: 'cash', name: 'Cash', description: 'Pay with physical currency' },
        { id: 'upi', name: 'UPI', description: 'Google Pay, PhonePe, etc.' },
        { id: 'card', name: 'Card', description: 'Credit or Debit Card' },
        { id: 'due', name: 'Due', description: 'Record as outstanding' },
    ];

    useEffect(() => {
        if (isOpen) {
            setSelectedPayments({ cash: subtotal > 0 ? finalPayableAmount : 0 });
            setDiscount(0);
            setIsDiscountLocked(true);
            setPartyName('');
            setPartyNumber('');
        }
    }, [isOpen, subtotal, finalPayableAmount]);

    const handleDiscountChange = (amount: string) => {
        const numAmount = parseFloat(amount);
        const newDiscount = isNaN(numAmount) ? 0 : numAmount;
        setDiscount(newDiscount);
        const newFinalPayable = subtotal - (subtotal * (newDiscount / 100));
        const paymentModes = Object.keys(selectedPayments);
        if (paymentModes.length === 1) {
            const singleMode = paymentModes[0];
            setSelectedPayments({ [singleMode]: newFinalPayable });
        }
    };

    const handleModeToggle = (modeId: string) => {
        setSelectedPayments(prev => {
            const newPayments = { ...prev };
            if (newPayments[modeId] !== undefined) {
                delete newPayments[modeId];
            } else {
                newPayments[modeId] = Object.keys(newPayments).length === 0 ? finalPayableAmount : 0;
            }
            return newPayments;
        });
    };

    const handleAmountChange = (modeId: string, amount: string) => {
        const numAmount = parseFloat(amount);
        setSelectedPayments(prev => ({ ...prev, [modeId]: isNaN(numAmount) ? 0 : numAmount }));
    };

    const handleFillRemaining = (modeId: string) => {
        const currentAmount = selectedPayments[modeId] || 0;
        const amountToFill = Math.max(0, remainingAmount);
        handleAmountChange(modeId, (currentAmount + amountToFill).toFixed(2));
    };

    const handleConfirm = async () => {
        if (!partyName.trim()) {
            setModal({ message: 'Please enter a Party Name.', type: 'error' });
            return;
        }
        if (Math.abs(remainingAmount) > 0.01) {
            setModal({ message: `Amount mismatch. Remaining: ₹${remainingAmount.toFixed(2)}`, type: 'error' });
            return;
        }
        setIsSubmitting(true);
        try {
            await onPaymentComplete({
                paymentDetails: selectedPayments,
                partyName,
                partyNumber,
                discount,
                finalAmount: finalPayableAmount,
            });
        } catch (error) {
            setModal({ message: (error as Error).message || 'Failed to save sale.', type: 'error' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40" onClick={onClose}>
            {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-50 rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sticky top-0 bg-gray-50 z-10 border-b">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-2"></div>
                    <h2 className="text-xl font-bold text-center text-gray-800">Payment</h2>
                </div>
                <div className="overflow-y-auto p-3 space-y-3">
                    <div className="bg-white rounded-xl shadow-sm p-3 space-y-2">
                        <h3 className="font-semibold text-gray-800 text-sm">Customer Details</h3>
                        <input type="text" placeholder="Party Name*" value={partyName} onChange={(e) => setPartyName(e.target.value)} className="w-full bg-gray-100 p-2 text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500" />
                        <input type="text" placeholder="Party Number (Optional)" value={partyNumber} onChange={(e) => setPartyNumber(e.target.value)} className="w-full bg-gray-100 p-2 text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        {transactionModes.map((mode) => {
                            const isSelected = selectedPayments[mode.id] !== undefined;
                            return (
                                <div key={mode.id}>
                                    <div onClick={() => handleModeToggle(mode.id)} className={`p-3 rounded-lg shadow-sm cursor-pointer aspect-square flex flex-col items-center justify-center text-center transition-all duration-200 ${isSelected ? 'bg-blue-600 text-white border-2 border-blue-700' : 'bg-white text-gray-800 border'}`}>
                                        <h3 className="font-semibold text-sm">{mode.name}</h3>
                                        <p className={`text-xs mt-1 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}>{mode.description}</p>
                                    </div>
                                    {isSelected && (
                                        <div className="mt-2 flex items-center gap-1">
                                            <span className="font-bold text-gray-700">₹</span>
                                            <input type="number" placeholder="0.00" value={selectedPayments[mode.id] || ''} onChange={(e) => handleAmountChange(mode.id, e.target.value)} className="flex-grow w-full bg-gray-100 p-1 text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500" />
                                            {remainingAmount > 0.01 && <button onClick={() => handleFillRemaining(mode.id)} className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-1 rounded-full hover:bg-blue-200">Fill</button>}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <div className="p-4 mt-auto sticky bottom-0 bg-white border-t">
                    <div className="flex justify-between items-center mb-2"><span className="text-sm text-gray-600">Subtotal:</span><span className="font-medium text-sm">₹{subtotal.toFixed(2)}</span></div>
                    <div className="flex items-center justify-between mb-2 gap-2" onMouseDown={() => setIsDiscountLocked(false)}>
                        <label htmlFor="discount" className="text-sm text-gray-600">Discount (%):</label>
                        <input id="discount" type="number" placeholder="0.00" value={discount || ''} onChange={(e) => handleDiscountChange(e.target.value)} readOnly={isDiscountLocked} className={`w-20 text-right bg-gray-100 p-1 text-sm rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${isDiscountLocked ? 'cursor-not-allowed' : ''}`} />
                    </div>
                    <div className="flex justify-between items-center mb-2 border-t pt-2"><span className="text-gray-800 font-semibold">Total Payable:</span><span className="font-bold text-lg text-blue-600">₹{finalPayableAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between items-center mb-3"><span className="text-gray-600">Remaining:</span><span className={`font-bold text-md ${Math.abs(remainingAmount) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>₹{remainingAmount.toFixed(2)}</span></div>
                    <button onClick={handleConfirm} disabled={isSubmitting || Math.abs(remainingAmount) > 0.01} className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:bg-gray-400">
                        {isSubmitting ? 'Submitting...' : 'Confirm & Save Sale'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentDrawer;
