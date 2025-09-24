import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { useAuth, useDatabase } from '../context/auth-context';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { Spinner } from '../constants/Spinner';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useFilter } from './Filter';

interface SaleDoc {
  salesmanId: string;
  totalAmount: number;
  companyId: string;
  createdAt: any; // Firestore Timestamp
}
interface TopSalesperson {
  name: string;
  billCount: number;
  totalAmount: number;
}

// ✅ The hook no longer needs any parameters
const useTopSalespeople = () => {
  const { currentUser } = useAuth(); // Get user from the auth context
  const dbOperations = useDatabase(); // Get DB functions from the database context
  const { filters } = useFilter();

  const [topSalespeople, setTopSalespeople] = useState<TopSalesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Wait for all required data from contexts and filters.
    if (!currentUser || !currentUser.companyId || !dbOperations || !filters.startDate || !filters.endDate) {
      // If contexts are not ready yet, we are in a loading state.
      setLoading(!currentUser || !dbOperations);
      return;
    }

    setLoading(true);

    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);

    // ✅ Query is now simpler and safer, using data directly from our hooks.
    const salesQuery = query(
      collection(db, 'sales'),
      where('companyId', '==', currentUser.companyId), // Ensures multi-company safety
      where('createdAt', '>=', start),
      where('createdAt', '<=', end)
    );

    const unsubscribe = onSnapshot(salesQuery, async (snapshot) => {
      try {
        // Get the list of valid salesmen for this company
        const salesmen = await dbOperations.getSalesmen();
        const salesmanMap = new Map(salesmen.map(s => [s.uid, s.name]));

        if (salesmanMap.size === 0) {
          setTopSalespeople([]);
          setLoading(false);
          return;
        }

        const stats = new Map<string, { billCount: number; totalAmount: number }>();

        snapshot.docs.forEach((doc) => {
          const sale = doc.data() as SaleDoc;
          // Aggregate stats only for valid salesmen
          if (sale.salesmanId && salesmanMap.has(sale.salesmanId)) {
            const currentStats = stats.get(sale.salesmanId) || { billCount: 0, totalAmount: 0 };
            stats.set(sale.salesmanId, {
              billCount: currentStats.billCount + 1,
              totalAmount: currentStats.totalAmount + (sale.totalAmount || 0),
            });
          }
        });

        if (stats.size === 0) {
          setTopSalespeople([]);
          return;
        }

        const topUsers = Array.from(stats.entries())
          .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
          .slice(0, 5)
          .map(([userId, { billCount, totalAmount }]) => ({
            name: salesmanMap.get(userId) || 'Unknown',
            billCount,
            totalAmount,
          }));

        setTopSalespeople(topUsers);
        setError(null);

      } catch (err) {
        console.error('Error processing sales data:', err);
        setError('Failed to process sales data.');
      } finally {
        setLoading(false);
      }

    }, (err: Error) => {
      console.error('Error fetching sales:', err);
      setError(`Failed to load sales data: ${err.message}`);
      setLoading(false);
    });

    // ✅ Standard and simple cleanup for the listener
    return () => unsubscribe();

  }, [currentUser, dbOperations, filters]);

  return { topSalespeople, loading, error };
};

interface TopSalespersonCardProps {
  isDataVisible: boolean;
}

export const TopSalespersonCard: React.FC<TopSalespersonCardProps> = ({ isDataVisible }) => {
  // ✅ No longer need to pass user?.uid here
  const { topSalespeople, loading, error } = useTopSalespeople();

  const renderContent = () => {
    if (loading) return <Spinner />;
    if (error) return <p className="text-center text-red-500">{error}</p>;

    if (!isDataVisible) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-gray-500 py-8">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
          Data is hidden
        </div>
      );
    }

    if (topSalespeople.length === 0) {
      return <p className="text-center text-gray-500 py-8">No sales data for this period.</p>;
    }

    return (
      <ul className="space-y-4">
        {topSalespeople.map((person, index) => (
          <li key={person.name + index} className="flex items-center">
            <div className="flex items-center w-2/5">
              <span className="text-sm font-bold text-blue-600 bg-blue-100 rounded-full h-6 w-6 flex items-center justify-center mr-3 flex-shrink-0">
                {index + 1}
              </span>
              <span className="font-medium text-gray-700 truncate">{person.name}</span>
            </div>
            <div className="w-1/5 text-center">
              <span className="text-xs text-gray-500">{person.billCount} sales</span>
            </div>
            <div className="w-2/5 text-right">
              <span className="font-semibold text-gray-800">
                {person.totalAmount.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top 5 Salespeople</CardTitle>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
};