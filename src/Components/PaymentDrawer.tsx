import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FloatingLabelInput } from './ui/FloatingLabelInput';
import { transactiontypes } from '../constants/Transactiontype';
import { Modal } from '../constants/Modal';
import { State } from '../enums';
export interface PaymentDetails {
    [key: string]: number;
}
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

// --- Main PaymentDrawer Component ---
const PaymentDrawer: React.FC<PaymentDrawerProps> = ({ isOpen, onClose, subtotal, onPaymentComplete }) => {
    const [partyName, setPartyName] = useState('NA');
    const [partyNumber, setPartyNumber] = useState('');
    const [discount, setDiscount] = useState(0);
    const [selectedPayments, setSelectedPayments] = useState<PaymentDetails>({});
    const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDiscountLocked, setIsDiscountLocked] = useState(true);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const finalPayableAmount = useMemo(() => Math.max(0, subtotal - discount), [subtotal, discount]);
    const totalEnteredAmount = useMemo(() => Object.values(selectedPayments).reduce((sum: number, amount: number) => sum + (amount || 0), 0), [selectedPayments]);
    const remainingAmount = useMemo(() => finalPayableAmount - totalEnteredAmount, [finalPayableAmount, totalEnteredAmount]);
    const [discountInfo, setDiscountInfo] = useState<string | null>(null);


    useEffect(() => {
        if (isOpen) {
            const initialDiscount = 0;


            setDiscount(initialDiscount);
            setSelectedPayments({});
            setPartyName('NA'); // Reset party name to 'NA' on open
            setPartyNumber('');
            setIsDiscountLocked(true); // Always re-lock discount when opening
        }
    }, [isOpen, subtotal]);

    const handleDiscountPressStart = () => {
        longPressTimer.current = setTimeout(() => {
            setIsDiscountLocked(false);
        }, 500); // 500ms for a long press
    };

    const handleDiscountPressEnd = () => {
        if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
        }
    };

    const handleDiscountClick = () => {
        if (isDiscountLocked) {
            setDiscountInfo("Cannot edit discount.");
            // Clear the message automatically after 3 seconds
            setTimeout(() => setDiscountInfo(null), 3000);
        }
    };

    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const amount = e.target.value;
        const numAmount = parseFloat(amount);
        const newDiscount = isNaN(numAmount) ? 0 : numAmount;
        setDiscount(newDiscount);

        // When discount is changed, auto-update the amount if only one payment mode is selected
        const newFinalPayable = subtotal - newDiscount;
        const paymentModes = Object.keys(selectedPayments);
        if (paymentModes.length === 1) {
            const singleMode = paymentModes[0];
            setSelectedPayments({ [singleMode]: newFinalPayable });
        }
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
            setModal({ message: 'Party Name is required.', type: State.ERROR });
            return;
        }
        if (Math.abs(remainingAmount) > 0.01) {
            setModal({ message: `Amount mismatch. Remaining: ₹${remainingAmount.toFixed(2)}`, type: State.ERROR });
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
            setModal({ message: (error as Error).message || 'Failed to save sale.', type: State.ERROR });
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
                    <button
                        onClick={onClose}
                        className="rounded-full bg-gray-200 p-2 text-gray-900"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                        >
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                    <h2 className="text-xl font-bold text-center text-gray-800">Payment</h2>
                </div>
                <div className="overflow-y-auto p-3 space-y-3">
                    <div className="bg-white rounded-xl shadow-sm p-3 space-y-2">
                        <h3 className="font-semibold text-gray-800 text-sm">Customer Details</h3>
                        <input type="text" placeholder="Party Name*" value={partyName} onChange={(e) => setPartyName(e.target.value)} className="w-full bg-gray-100 p-2 text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500" />
                        <input type="text" placeholder="Party Number (Optional)" value={partyNumber} onChange={(e) => setPartyNumber(e.target.value)} className="w-full bg-gray-100 p-2 text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {transactiontypes.map((mode) => (
                            <FloatingLabelInput
                                key={mode.id}
                                id={mode.id}
                                label={mode.name}
                                value={selectedPayments[mode.id]?.toString() || ''}
                                onChange={(e) => handleAmountChange(mode.id, e.target.value)}
                                onFill={() => handleFillRemaining(mode.id)}
                                showFillButton={remainingAmount > 0.01}
                            />
                        ))}
                    </div>
                </div>
                <div className="p-4 mt-auto sticky bottom-0 bg-white border-t">
                    <div className="flex justify-between items-center mb-2"><span className="text-sm text-gray-600">Subtotal:</span><span className="font-medium text-sm">₹{subtotal.toFixed(2)}</span></div>
                    <div
                        className="flex items-center justify-between mb-2 gap-2 p-2 -m-2 rounded-lg"
                        onMouseDown={handleDiscountPressStart}
                        onMouseUp={handleDiscountPressEnd}
                        onMouseLeave={handleDiscountPressEnd}
                        onTouchStart={handleDiscountPressStart}
                        onTouchEnd={handleDiscountPressEnd}
                        onClick={handleDiscountClick}
                    >
                        <label htmlFor="discount" className={`text-sm text-gray-600 ${isDiscountLocked ? 'cursor-pointer' : ''}`}>Discount (%):</label>
                        {discountInfo && (
                            <div className="flex items-center text-red-700 text-xs mb-1 p-1 bg-blue-50 rounded-md">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span>{discountInfo}</span>
                            </div>
                        )}
                        <input id="discount" type="number" placeholder="0.00" value={discount || ''} onChange={handleDiscountChange} readOnly={isDiscountLocked} className={`w-20 text-right bg-gray-100 p-1 text-sm rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${isDiscountLocked ? 'cursor-not-allowed text-gray-500' : ''}`} />
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

