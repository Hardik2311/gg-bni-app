import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/auth-context';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import type { FirestoreError } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { useFilter } from './Filter';

const useSalesComparison = (userId: string | undefined) => {
  const { filters } = useFilter(); // Use the global filter state
  const [sales, setSales] = useState(0);
  const [comparisonSales, setComparisonSales] = useState(0); // For "vs yesterday", etc.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !userId || !filters.startDate || !filters.endDate) {
      setLoading(false);
      return;
    }
    setLoading(true);

    const salesCollection = collection(db, 'sales');

    // --- Main Date Range (from filter) ---
    const startDate = new Date(filters.startDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(filters.endDate);
    endDate.setHours(23, 59, 59, 999);

    // --- Comparison Date Range ---
    const dateDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
    const comparisonStartDate = new Date(startDate);
    comparisonStartDate.setDate(startDate.getDate() - (dateDiff + 1));
    const comparisonEndDate = new Date(startDate);
    comparisonEndDate.setDate(startDate.getDate() - 1);
    comparisonEndDate.setHours(23, 59, 59, 999);


    // Query for the main sales period
    const qSales = query(
      salesCollection,
      where('createdAt', '>=', startDate),
      where('createdAt', '<=', endDate)
    );

    // Query for the comparison sales period
    const qComparison = query(
      salesCollection,
      where('createdAt', '>=', comparisonStartDate),
      where('createdAt', '<=', comparisonEndDate)
    );

    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      let total = 0;
      snapshot.forEach((doc) => total += doc.data().totalAmount || 0);
      setSales(total);
      setLoading(false);
    }, (err: FirestoreError) => {
      console.error("Sales snapshot error: ", err);
      setError(`Failed to load sales data: ${err.message}`);
      setLoading(false);
    });

    const unsubscribeComparison = onSnapshot(qComparison, (snapshot) => {
      let total = 0;
      snapshot.forEach((doc) => total += doc.data().totalAmount || 0);
      setComparisonSales(total);
    }, (err: FirestoreError) => {
      console.error("Comparison sales snapshot error: ", err);
      // Don't set a fatal error, just log it.
    });

    return () => {
      unsubscribeSales();
      unsubscribeComparison();
    };
  }, [userId, filters]); // Re-run when the global filter changes

  return { sales, comparisonSales, loading, error };
};
interface SalesCardProps {
  isDataVisible: boolean;

}

export const SalesCard: React.FC<SalesCardProps> = ({ isDataVisible }) => {
  const { currentUser } = useAuth();
  const { sales, comparisonSales, loading, error } = useSalesComparison(
    currentUser?.uid,
  );

  const percentageChange = useMemo(() => {
    if (loading || error) return 0;
    if (comparisonSales === 0) {
      return sales > 0 ? 100 : 0;
    }
    return ((sales - comparisonSales) / comparisonSales) * 100;
  }, [sales, comparisonSales, loading, error]);

  const isPositive = percentageChange >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Sales</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : (
          <div className="text-center">
            <p className="text-4xl font-bold text-blue-600">
              {isDataVisible ? `₹${sales.toLocaleString('en-IN')}` : '₹ ******'}
            </p>
            <p className="text-md text-gray-500 mt-2">
              <span className={`font-bold ${isDataVisible ? (isPositive ? 'text-green-600' : 'text-red-600') : 'text-gray-500'}`}>
                {isDataVisible ? `${percentageChange.toFixed(1)}%` : '**.*%'}
              </span>{' '}
              vs. previous period
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}