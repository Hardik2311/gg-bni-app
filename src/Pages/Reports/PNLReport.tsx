import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/auth-context';
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

// --- Data Types ---
interface Transaction {
  id: string;
  totalAmount: number;
  createdAt: Date;
}
interface PnlSummary {
  totalRevenue: number;
  totalCost: number;
  netProfit: number;
}

// --- Reusable Components (to match other reports) ---
const SummaryCard: React.FC<{ title: string; value: string; valueClassName?: string }> =
  ({ title, value, valueClassName = 'text-gray-900' }) => (
    <div className="bg-white p-6 rounded-lg shadow-md text-center">
      <h3 className="text-sm font-medium text-gray-500">{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${valueClassName}`}>{value}</p>
    </div>
  );

const FilterInput: React.FC<{
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}> = ({ label, type = 'text', value, onChange }) => (
  <div className="flex-1 min-w-0">
    <label className="block text-xs text-center font-medium text-gray-600 mb-1">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="w-full p-2 text-sm text-center bg-gray-50 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    />
  </div>
);


// --- Custom Hook for P&L Data (No changes needed here) ---
const usePnlReport = (userId: string | undefined) => {
  const [sales, setSales] = useState<Transaction[]>([]);
  const [purchases, setPurchases] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const salesCollectionRef = collection(db, 'sales');
    const purchasesCollectionRef = collection(db, 'purchases');
    const qSales = query(salesCollectionRef, where('userId', '==', userId));
    const qPurchases = query(purchasesCollectionRef, where('userId', '==', userId));

    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({
        id: doc.id,
        totalAmount: doc.data().totalAmount || 0,
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
      })));
    }, (_err) => setError('Failed to fetch sales data.'));

    const unsubscribePurchases = onSnapshot(qPurchases, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({
        id: doc.id,
        totalAmount: doc.data().totalAmount || 0,
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
      })));
    }, (_err) => setError('Failed to fetch purchases data.'));

    setLoading(false);

    return () => {
      unsubscribeSales();
      unsubscribePurchases();
    };
  }, [userId]);

  return { sales, purchases, loading, error };
};


// --- Main P&L Report Component ---
const PnlReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const {
    sales,
    purchases,
    loading: dataLoading,
    error,
  } = usePnlReport(currentUser?.uid);

  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const pnlSummary: PnlSummary = useMemo(() => {
    const startTimestamp = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : 0;
    const endTimestamp = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;

    const filteredSales = sales.filter(s => s.createdAt.getTime() >= startTimestamp && s.createdAt.getTime() <= endTimestamp);
    const filteredPurchases = purchases.filter(p => p.createdAt.getTime() >= startTimestamp && p.createdAt.getTime() <= endTimestamp);

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalCost = filteredPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
    const netProfit = totalRevenue - totalCost;

    return { totalRevenue, totalCost, netProfit };
  }, [sales, purchases, startDate, endDate]);

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
  };

  if (authLoading || dataLoading) {
    return <div className="p-4 text-center">Loading Report...</div>;
  }
  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }
  if (!currentUser) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* --- Header --- */}
      <div className="flex items-center justify-between pb-3 border-b mb-4">
        <h1 className="flex-1 text-xl text-center font-bold text-gray-800">
          Profit & Loss Report
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-gray-200 p-2 text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* --- Main Filters Section (New Layout) --- */}
      <div className="bg-white p-3 rounded-lg shadow-md mb-6">
        <h2 className="text-center font-semibold text-gray-700 mb-2">FILTERS</h2>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <FilterInput
            label="From"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <FilterInput
            label="To"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <div className="flex-1 min-w-0">
            <label className="block text-xs text-center font-medium text-transparent mb-1">.</label>
            <button
              onClick={handleClearFilters}
              className="w-full bg-gray-600 text-white rounded-md p-2 text-sm shadow-sm hover:bg-gray-700"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* --- P&L Summary Cards (New Layout) --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard
          title="Total Revenue"
          value={`₹${pnlSummary.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          valueClassName="text-green-600"
        />
        <SummaryCard
          title="Total Costs"
          value={`₹${pnlSummary.totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          valueClassName="text-red-600"
        />
        <SummaryCard
          title="Net Profit / Loss"
          value={`₹${pnlSummary.netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          valueClassName={pnlSummary.netProfit >= 0 ? "text-blue-600" : "text-red-600"}
        />
      </div>
    </div>
  );
};

export default PnlReportPage;