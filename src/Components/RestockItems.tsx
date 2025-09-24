import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { db } from '../lib/firebase';
import {
    collection,
    query,
    onSnapshot,
    where,
} from 'firebase/firestore';
import { Spinner } from '../constants/Spinner';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from './ui/card';

// --- Data Types ---
interface ItemDoc {
    id: string;
    name: string;
    amount: number;         // The current stock quantity
    restockQuantity: number; // The alert threshold
    companyId: string;
}

/**
 * Custom hook to fetch items that need restocking for a specific company.
 * An item needs restocking if its current amount is less than or equal to its restock quantity.
 * @param companyId The ID of the company to fetch item data for.
 */
const useRestockAlerts = (companyId?: string) => {
    const [itemsToRestock, setItemsToRestock] = useState<ItemDoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!companyId) {
            setLoading(false);
            setItemsToRestock([]);
            return;
        }
        setLoading(true);
        setError(null);

        const itemsQuery = query(
            collection(db, 'items'),
            where('companyId', '==', companyId)
        );

        const unsubscribe = onSnapshot(itemsQuery, (snapshot) => {
            const allItems: ItemDoc[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ItemDoc));

            // Filter for items that need restocking
            const filteredItems = allItems.filter(item =>
                item.restockQuantity > 0 && item.amount <= item.restockQuantity
            );

            // Sort by urgency (how far below the threshold the item is)
            filteredItems.sort((a, b) => (a.amount - a.restockQuantity) - (b.amount - b.restockQuantity));

            setItemsToRestock(filteredItems);
            setLoading(false);
        }, (err: Error) => {
            console.error('Error fetching items for restock alerts:', err);
            setError(`Failed to load restock alerts: ${err.message}`);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyId]);

    return { itemsToRestock, loading, error };
};


export const RestockAlertsCard: React.FC = ({ }) => {
    const { currentUser } = useAuth();
    const { itemsToRestock, loading, error } = useRestockAlerts(currentUser?.companyId);

    const renderContent = () => {
        if (loading) return <Spinner />;
        if (error) return <p className="text-center text-red-500">{error}</p>;


        if (itemsToRestock.length === 0) {
            return <p className="text-center text-gray-500">All items are well-stocked! 👍</p>;
        }

        return (
            <ul className="space-y-4">
                {itemsToRestock.map((item) => {
                    const isOutOfStock = item.amount <= 0;
                    return (
                        <li key={item.id} className="flex items-center justify-between">
                            <div className="flex items-center">
                                <span className={`h-3 w-3 rounded-full mr-3 ${isOutOfStock ? 'bg-red-500' : 'bg-yellow-400'}`}></span>
                                <span className="font-medium text-gray-700">{item.name.slice(0, 20)}</span>
                            </div>
                            <div className="text-right">
                                <span className={`font-semibold ${isOutOfStock ? 'text-red-600' : 'text-gray-800'}`}>
                                    {item.amount} in stock
                                </span>
                                <span className="text-xs text-gray-500 block">
                                    Alert at {item.restockQuantity}
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Restock Alerts</CardTitle>
            </CardHeader>
            <CardContent>{renderContent()}</CardContent>
        </Card>
    );
};