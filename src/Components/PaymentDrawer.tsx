import React, { useState, useEffect, useMemo, useRef } from 'react';
import { FloatingLabelInput } from './ui/FloatingLabelInput';
import { transactiontypes } from '../constants/Transactiontype';
import { Modal } from '../constants/Modal';
import { State } from '../enums';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp, increment as firebaseIncrement } from 'firebase/firestore';
import { useAuth } from '../context/auth-context';

export interface PaymentDetails {
    [key: string]: number;
}
export interface PaymentCompletionData {
    paymentDetails: PaymentDetails;
    partyName: string;
    partyNumber: string;
    discount: number;
    finalAmount: number;
    appliedCredit: number;
    appliedDebit: number;
}

// ✅ FIX: Added new props to handle edit mode
interface PaymentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    subtotal: number;
    onPaymentComplete: (data: PaymentCompletionData) => Promise<void>;
    isPartyNameEditable?: boolean;
    initialPartyName?: string;
    initialPartyNumber?: string;
}

const PaymentDrawer: React.FC<PaymentDrawerProps> = ({
    isOpen,
    onClose,
    subtotal,
    onPaymentComplete,
    // ✅ FIX: Destructure new props with default values
    isPartyNameEditable = true,
    initialPartyName,
    initialPartyNumber,
}) => {
    const { currentUser } = useAuth();
    const [partyName, setPartyName] = useState('NA');
    const [partyNumber, setPartyNumber] = useState('');
    const [discount, setDiscount] = useState(0);
    const [customerCredit, setCustomerCredit] = useState(0);
    const [customerDebit, setCustomerDebit] = useState(0);
    const [useCredit, setUseCredit] = useState(false);
    const [useDebit, setUseDebit] = useState(false);
    const [selectedPayments, setSelectedPayments] = useState<PaymentDetails>({});
    const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDiscountLocked, setIsDiscountLocked] = useState(true);
    const [isFetchingParty, setIsFetchingParty] = useState(false);
    const longPressTimer = useRef<NodeJS.Timeout | null>(null);
    const [discountInfo, setDiscountInfo] = useState<string | null>(null);

    const appliedCredit = useMemo(() => {
        if (!useCredit || customerCredit <= 0) return 0;
        const amountAfterDiscount = subtotal - discount;
        return Math.min(amountAfterDiscount, customerCredit);
    }, [useCredit, customerCredit, subtotal, discount]);

    const appliedDebit = useMemo(() => {
        if (!useDebit || customerDebit <= 0) return 0;
        const amountAfterDiscountAndCredit = subtotal - discount - appliedCredit;
        return Math.min(amountAfterDiscountAndCredit, customerDebit);
    }, [useDebit, customerDebit, subtotal, discount, appliedCredit]);

    const finalPayableAmount = useMemo(() => Math.max(0, subtotal - discount - appliedCredit - appliedDebit), [subtotal, discount, appliedCredit, appliedDebit]);
    const totalEnteredAmount = useMemo(() => Object.values(selectedPayments).reduce((sum, amount) => sum + (amount || 0), 0), [selectedPayments]);
    const remainingAmount = useMemo(() => finalPayableAmount - totalEnteredAmount, [finalPayableAmount, totalEnteredAmount]);

    // ✅ FIX: This effect now uses the initial props to set the state for edit mode
    useEffect(() => {
        if (isOpen) {
            setDiscount(0);
            setSelectedPayments({});
            setPartyName(initialPartyName || 'NA');
            setPartyNumber(initialPartyNumber || '');
            setIsDiscountLocked(true);
            setCustomerCredit(0);
            setUseCredit(false);
            setCustomerDebit(0);
            setUseDebit(false);
        }
    }, [isOpen, subtotal, initialPartyName, initialPartyNumber]);

    const handlePartyNumberBlur = async () => {
        setCustomerCredit(0);
        setUseCredit(false);
        setCustomerDebit(0);
        setUseDebit(false);
        if (!partyNumber || partyNumber.length < 10 || !currentUser?.companyId) return;

        setIsFetchingParty(true);
        try {
            const customerDocRef = doc(db, 'customers', partyNumber);
            const customerDoc = await getDoc(customerDocRef);
            if (customerDoc.exists()) {
                const customerData = customerDoc.data();
                if (customerData.companyId === currentUser.companyId) {
                    setPartyName(customerData.name);
                    const availableCredit = customerData.creditBalance || 0;
                    if (availableCredit > 0) {
                        setCustomerCredit(availableCredit);
                        setUseCredit(true);
                    }
                    const availableDebit = customerData.debitBalance || 0;
                    if (availableDebit > 0) {
                        setCustomerDebit(availableDebit);
                        setUseDebit(true);
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching customer:", error);
        } finally {
            setIsFetchingParty(false);
        }
    };

    const handleAmountChange = (modeId: string, amount: string) => {
        const numAmount = parseFloat(amount) || 0;
        setSelectedPayments(prev => ({ ...prev, [modeId]: numAmount }));
    };

    const handleFillRemaining = (modeId: string) => {
        const currentAmount = selectedPayments[modeId] || 0;
        const amountToFill = Math.max(0, remainingAmount);
        handleAmountChange(modeId, (currentAmount + amountToFill).toFixed(2));
    };

    const handleConfirm = async () => {
        if (!partyName.trim()) {
            setModal({ message: 'A valid Party Name is required.', type: State.ERROR });
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
                partyName, partyNumber, discount,
                finalAmount: finalPayableAmount,
                appliedCredit,
                appliedDebit,
            });

            if (partyNumber && partyNumber.length >= 10 && currentUser?.companyId) {
                const customerDocRef = doc(db, 'customers', partyNumber);
                await setDoc(customerDocRef, {
                    name: partyName, number: partyNumber, companyId: currentUser.companyId,
                    lastSaleAt: serverTimestamp(),
                    creditBalance: firebaseIncrement(-appliedCredit),
                    debitBalance: firebaseIncrement(-appliedDebit),
                }, { merge: true });
            }
        } catch (error) {
            setModal({ message: (error as Error).message || 'Failed to save sale.', type: State.ERROR });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDiscountPressStart = () => longPressTimer.current = setTimeout(() => setIsDiscountLocked(false), 500);
    const handleDiscountPressEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); };
    const handleDiscountClick = () => {
        if (isDiscountLocked) {
            setDiscountInfo("Cannot edit the Discount.");
            setTimeout(() => setDiscountInfo(null), 3000);
        }
    };
    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newDiscount = parseFloat(e.target.value) || 0;
        setDiscount(newDiscount);
        const newFinalPayable = subtotal - newDiscount - appliedCredit - appliedDebit;
        const paymentModes = Object.keys(selectedPayments);
        if (paymentModes.length === 1) {
            const singleMode = paymentModes[0];
            if (singleMode !== 'creditNote') {
                setSelectedPayments({ [singleMode]: newFinalPayable });
            }
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}>
            {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
            <div className="fixed bottom-0 left-0 right-0 bg-gray-50 rounded-t-2xl shadow-xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 sticky top-0 bg-gray-50 z-10 border-b">
                    <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-2"></div>
                    <button onClick={onClose} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-gray-200 p-2 text-gray-900">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
                    </button>
                    <h2 className="text-xl font-bold text-center text-gray-800">Payment</h2>
                </div>
                <div className="overflow-y-auto p-3 space-y-3">
                    <div className="bg-white rounded-xl shadow-sm p-3 space-y-2">
                        <h3 className="font-semibold text-gray-800 text-sm">Customer Details</h3>
                        <div className="relative">
                            <input
                                type="number"
                                placeholder="Party Number"
                                value={partyNumber}
                                onChange={(e) => setPartyNumber(e.target.value)}
                                onBlur={handlePartyNumberBlur}
                                // ✅ FIX: Input is now read-only in edit mode
                                readOnly={!isPartyNameEditable}
                                className={`w-full bg-gray-100 p-2 text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${!isPartyNameEditable ? 'cursor-not-allowed' : ''}`}
                            />
                            {isFetchingParty && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">Searching...</div>}
                        </div>
                        <input
                            type="text"
                            placeholder="Party Name*"
                            value={partyName}
                            onChange={(e) => setPartyName(e.target.value)}
                            // ✅ FIX: Input is now read-only in edit mode
                            readOnly={!isPartyNameEditable}
                            className={`w-full bg-gray-100 p-2 text-sm rounded-lg border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${!isPartyNameEditable ? 'cursor-not-allowed' : ''}`}
                        />
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
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Subtotal:</span>
                        <span className="font-medium text-sm">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mb-2 gap-2 p-2 -m-2 rounded-lg" onMouseDown={handleDiscountPressStart} onMouseUp={handleDiscountPressEnd} onMouseLeave={handleDiscountPressEnd} onTouchStart={handleDiscountPressStart} onTouchEnd={handleDiscountPressEnd} onClick={handleDiscountClick}>
                        <label htmlFor="discount" className={`text-sm text-gray-600 ${isDiscountLocked ? 'cursor-pointer' : ''}`}>Discount (₹):</label>
                        {discountInfo && <div className="...">{discountInfo}</div>}
                        <input id="discount" type="number" placeholder="0.00" value={discount || ''} onChange={handleDiscountChange} readOnly={isDiscountLocked} className={`w-20 text-right bg-gray-100 p-1 text-sm rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${isDiscountLocked ? 'cursor-not-allowed text-gray-500' : ''}`} />
                    </div>

                    {customerCredit > 0 && (
                        <div className="flex justify-between items-center mb-2 text-green-600">
                            <label htmlFor="useCreditCheckbox" className="flex items-center text-sm cursor-pointer">
                                <input type="checkbox" id="useCreditCheckbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="ml-2">Credit Balance (Available: ₹{customerCredit.toFixed(2)})</span>
                            </label>
                            <span className="font-medium text-sm">- ₹{appliedCredit.toFixed(2)}</span>
                        </div>
                    )}

                    {customerDebit > 0 && (
                        <div className="flex justify-between items-center mb-2 text-orange-600">
                            <label htmlFor="useDebitCheckbox" className="flex items-center text-sm cursor-pointer">
                                <input type="checkbox" id="useDebitCheckbox" checked={useDebit} onChange={(e) => setUseDebit(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                <span className="ml-2">Debit Note (Available: ₹{customerDebit.toFixed(2)})</span>
                            </label>
                            <span className="font-medium text-sm">- ₹{appliedDebit.toFixed(2)}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-center mb-2 border-t pt-2">
                        <span className="text-gray-800 font-semibold">Total Payable:</span>
                        <span className="font-bold text-lg text-blue-600">₹{finalPayableAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center mb-3">
                        <span className="text-gray-600">Remaining:</span>
                        <span className={`font-bold text-md ${Math.abs(remainingAmount) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{remainingAmount.toFixed(2)}
                        </span>
                    </div>
                    <button onClick={handleConfirm} disabled={isSubmitting || Math.abs(remainingAmount) > 0.01} className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:bg-gray-400">
                        {isSubmitting ? 'Submitting...' : 'Confirm & Save Sale'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentDrawer;