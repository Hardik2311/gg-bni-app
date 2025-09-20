import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/auth-context';
import { collection, query, onSnapshot, doc, getDoc, where } from 'firebase/firestore';
import { Spinner } from '../constants/Spinner';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useFilter } from './Filter';
import { getSalesmen } from '../lib/user_firebase';

interface SaleDoc {
  userId: string;
  totalAmount: number;
}
interface TopSalesperson {
  name: string;
  billCount: number;
  totalAmount: number;
}

const useTopSalespeople = (currentUserId?: string) => {
  const { filters } = useFilter();
  const [topSalespeople, setTopSalespeople] = useState<TopSalesperson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId || !filters.startDate || !filters.endDate) {
      setTopSalespeople([]);
      setLoading(false);
      return;
    }

    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);

    const initializeAndListen = async () => {
      setLoading(true);
      try {
        const salesmen = await getSalesmen();
        const salesmanIds = new Set(salesmen.map(s => s.uid));

        if (salesmanIds.size === 0) {
          setTopSalespeople([]);
          setLoading(false);
          return;
        }

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

          const stats = new Map<string, { billCount: number; totalAmount: number }>();

          snapshot.docs.forEach((doc) => {
            const sale = doc.data() as SaleDoc;
            if (sale.userId && salesmanIds.has(sale.userId)) {
              const currentStats = stats.get(sale.userId) || { billCount: 0, totalAmount: 0 };
              stats.set(sale.userId, {
                billCount: currentStats.billCount + 1,
                totalAmount: currentStats.totalAmount + (sale.totalAmount || 0),
              });
            }
          });

          if (stats.size === 0) {
            setTopSalespeople([]);
            setLoading(false);
            return;
          }

          const topUsers = Array.from(stats.entries())
            .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
            .slice(0, 5);

          const topSalespeopleData = await Promise.all(
            topUsers.map(async ([userId, { billCount, totalAmount }]) => {
              const userDocRef = doc(db, 'users', userId);
              const userDocSnap = await getDoc(userDocRef);
              const name = userDocSnap.exists()
                ? userDocSnap.data().name || userDocSnap.data().displayName || 'Unknown'
                : 'Unknown';
              return { name, billCount, totalAmount };
            })
          );

          setTopSalespeople(topSalespeopleData);
          setError(null);
          setLoading(false);

        }, (err: Error) => {
          console.error('Error fetching sales:', err);
          setError(`Failed to load sales data: ${err.message}`);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (err) {
        console.error("Failed to initialize salespeople data:", err);
        setError("Failed to fetch salesperson roles.");
        setLoading(false);
      }
    };

    initializeAndListen();
  }, [currentUserId, filters]);

  return { topSalespeople, loading, error };
};

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
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
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