import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/auth-context';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  where, // Make sure 'where' is imported
} from 'firebase/firestore';
import { Spinner } from '../constants/Spinner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from './ui/card';
import { useFilter } from './Filter';

// --- Data Types ---
interface SalesItem {
  id: string;
  name: string;
  quantity: number;
}
interface SaleDoc {
  items: SalesItem[];
  userId: string;
  createdAt: Timestamp;
  companyId: string; // Added for type safety
}
interface AggregatedItem {
  name: string;
  totalQuantity: number;
}

/**
 * Custom hook to fetch the top-selling items for a specific company within a date range.
 * @param companyId The ID of the company to fetch sales data for.
 */
const useTopSoldItems = (companyId?: string) => {
  const { filters } = useFilter();
  const [topItems, setTopItems] = useState<AggregatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // --- FIX 1: Wait for companyId before running the query ---
    if (!companyId || !filters.startDate || !filters.endDate) {
      setLoading(false);
      setTopItems([]);
      return;
    }
    setLoading(true);
    setError(null);

    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);

    // --- FIX 2: Add 'where' clause for companyId to the query ---
    const salesQuery = query(
      collection(db, 'sales'),
      where('companyId', '==', companyId),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end)
    );

    const unsubscribe = onSnapshot(salesQuery, (snapshot) => {
      const itemMap = new Map<string, number>();
      snapshot.docs.forEach((doc) => {
        const sale = doc.data() as SaleDoc;
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach((item) => {
            const currentQuantity = itemMap.get(item.name) || 0;
            itemMap.set(item.name, currentQuantity + (item.quantity || 0));
          });
        }
      });

      const aggregatedList: AggregatedItem[] = Array.from(itemMap.entries())
        .map(([name, totalQuantity]) => ({ name, totalQuantity }));

      aggregatedList.sort((a, b) => b.totalQuantity - a.totalQuantity);
      setTopItems(aggregatedList.slice(0, 5));
      setLoading(false);
    }, (err: Error) => {
      console.error('Error fetching sales for top items:', err);
      setError(`Failed to load top items: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
    // --- FIX 3: Add companyId to the dependency array ---
  }, [companyId, filters]);

  return { topItems, loading, error };
};

// --- Main Top Sold Items Card Component ---
interface TopSoldItemsCardProps {
  isDataVisible: boolean;
}

export const TopSoldItemsCard: React.FC<TopSoldItemsCardProps> = ({ isDataVisible }) => {
  // --- FIX 4: Use 'currentUser' as requested and pass companyId to the hook ---
  const { currentUser } = useAuth(); // Renaming 'user' to 'currentUser'
  const { topItems, loading, error } = useTopSoldItems(currentUser?.companyId);

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

    if (topItems.length === 0) {
      return <p className="text-center text-gray-500">No sales data for this period.</p>;
    }

    return (
      <ul className="space-y-4">
        {topItems.map((item, index) => (
          <li key={item.name} className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm font-bold text-blue-600 bg-blue-100 rounded-full h-6 w-6 flex items-center justify-center mr-3">{index + 1}</span>
              <span className="font-medium text-gray-700">{item.name.slice(0, 18)}</span>
            </div>
            <span className="font-semibold text-gray-800">
              {item.totalQuantity} <span className="text-sm font-normal text-gray-500">sold</span>
            </span>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Sold Items</CardTitle>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
};

export default TopSoldItemsCard;
