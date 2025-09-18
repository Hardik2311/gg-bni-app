import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    onSnapshot,
    Timestamp,
    where,
} from 'firebase/firestore';
import { Spinner } from '../constants/Spinner';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from './ui/card';
import { useFilter } from './Filter'; // Assumes you have a global filter context

// --- Data Types ---
interface SaleDoc {
    paymentMethods?: { [key: string]: number };
    createdAt: Timestamp;
}

// --- 1. Custom Hook for Fetching & Aggregating Payment Data ---
const usePaymentData = (userId?: string) => {
    const { filters } = useFilter(); // Uses the global filter
    const [paymentData, setPaymentData] = useState<{ [key: string]: number }>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId || !filters.startDate || !filters.endDate) {
            setLoading(false);
            return;
        }
        setLoading(true);

        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);

        const salesQuery = query(
            collection(db, 'sales'),
            where('createdAt', '>=', start),
            where('createdAt', '<=', end)
        );

        const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
            // Aggregate totals for each payment method
            const paymentTotals = snapshot.docs.reduce((acc, doc) => {
                const sale = doc.data() as SaleDoc;
                if (sale.paymentMethods) {
                    for (const method in sale.paymentMethods) {
                        const capitalizedMethod = method.charAt(0).toUpperCase() + method.slice(1);
                        acc[capitalizedMethod] = (acc[capitalizedMethod] || 0) + sale.paymentMethods[method];
                    }
                }
                return acc;
            }, {} as { [key: string]: number });

            setPaymentData(paymentTotals);
            setLoading(false);
        }, (err: Error) => {
            console.error('Error fetching payment data:', err);
            setError(`Failed to load payment data: ${err.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [userId, filters]); // Re-runs when the global filter changes

    return { paymentData, loading, error };
};


// --- 2. Main Payment Chart Card Component ---
interface PaymentChartProps {
    isDataVisible: boolean;
}

export const PaymentChart: React.FC<PaymentChartProps> = ({ isDataVisible }) => {
    const { currentUser } = useAuth();
    // The component gets its own data from the custom hook
    const { paymentData, loading, error } = usePaymentData(currentUser?.uid);

    const renderContent = () => {
        if (loading) return <Spinner />;
        if (error) return <p className="text-center text-red-500">{error}</p>;

        if (!isDataVisible) {
            return (
                <div className="flex flex-col items-center justify-center text-center text-gray-500 py-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                    Data is hidden
                </div>
            );
        }

        const sortedData = Object.entries(paymentData).sort((a, b) => b[1] - a[1]);

        if (sortedData.length === 0) {
            return <p className="text-center text-gray-500">No payment data for this period.</p>;
        }

        const maxValue = Math.max(...sortedData.map(([, value]) => value), 1);

        return (
            <div className="space-y-4">
                {sortedData.map(([method, value]) => (
                    <div key={method}>
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="font-medium text-gray-600 capitalize">{method}</span>
                            <span className="font-semibold text-gray-800">₹{value.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${(value / maxValue) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>{renderContent()}</CardContent>
        </Card>
    );
};