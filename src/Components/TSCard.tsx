import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/auth-context';
import { collection, query, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { Spinner } from '../constants/Spinner';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useFilter } from './Filter';
import { where } from 'firebase/firestore';

// --- Data Types ---
interface SaleDoc {
  userId: string;
}
interface TopSalesperson {
  name: string;
  billCount: number;
}

const useTopSalespeople = (userId?: string) => {
  const { filters } = useFilter();
  const [topSalespeople, setTopSalespeople] = useState<TopSalesperson[]>([]);
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

    const unsubscribe = onSnapshot(salesQuery, async (snapshot) => {
      if (snapshot.empty) {
        setTopSalespeople([]);
        setLoading(false);
        return;
      }

      const billCounts = new Map<string, number>();
      snapshot.docs.forEach((doc) => {
        const sale = doc.data() as SaleDoc;
        if (sale.userId) {
          const currentCount = billCounts.get(sale.userId) || 0;
          billCounts.set(sale.userId, currentCount + 1);
        }
      });

      if (billCounts.size === 0) {
        setTopSalespeople([]);
        setLoading(false);
        return;
      }

      // Sort by bill count and take the top 5
      const topUsers = Array.from(billCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      try {
        // Fetch user profiles for the top 5
        const topSalespeopleData = await Promise.all(
          topUsers.map(async ([userId, billCount]) => {
            const userDocRef = doc(db, 'users', userId);
            const userDocSnap = await getDoc(userDocRef);
            const name = userDocSnap.exists()
              ? userDocSnap.data().name || userDocSnap.data().displayName || 'Unknown User'
              : 'Unknown User';
            return { name, billCount };
          })
        );
        setTopSalespeople(topSalespeopleData);
      } catch (err) {
        console.error('Error fetching user profiles:', err);
        setError("Failed to fetch salesperson names.");
      } finally {
        setLoading(false);
      }
    }, (err: Error) => {
      console.error('Error fetching sales for top salespeople:', err);
      setError(`Failed to load sales data: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, filters]);

  return { topSalespeople, loading, error };
};


// --- 4. Main Top Salesperson Card Component ---
interface TopSalespersonCardProps {
  isDataVisible: boolean;
}

export const TopSalespersonCard: React.FC<TopSalespersonCardProps> = ({ isDataVisible }) => {
  const { currentUser } = useAuth();
  const { topSalespeople, loading, error } = useTopSalespeople(currentUser?.uid);

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
      return <p className="text-center text-gray-500">No sales data for this period.</p>;
    }

    return (
      <ul className="space-y-4">
        {topSalespeople.map((person, index) => (
          <li key={person.name + index} className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm font-bold text-blue-600 bg-blue-100 rounded-full h-6 w-6 flex items-center justify-center mr-3">
                {index + 1}
              </span>
              <span className="font-medium text-gray-700 truncate">{person.name}</span>
            </div>
            <span className="font-semibold text-gray-800">
              {person.billCount} <span className="text-sm font-normal text-gray-500">sales</span>
            </span>
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
