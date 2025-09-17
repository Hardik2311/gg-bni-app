import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { useAuth } from '../../context/auth-context';
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

interface Transaction {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  createdAt: Date;
}
interface TransactionDetail extends Transaction {
  type: 'Revenue' | 'Cost';
}

const formatDateForInput = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

const SummaryCard: React.FC<{ title: string; value: string; valueClassName?: string }> =
  ({ title, value, valueClassName = 'text-gray-900' }) => (
    <div className="bg-white p-6 rounded-lg shadow-md text-center">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      <p className={`text-3xl font-bold mt-2 ${valueClassName}`}>{value}</p>
    </div>
  );

const FilterSelect: React.FC<{
  label?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <div className="flex-1 min-w-0">
    {label && <label className="block text-xs text-center font-medium text-gray-600 mb-1">{label}</label>}
    <select
      value={value}
      onChange={onChange}
      className="w-full p-2.5 text-sm bg-gray-50 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    >
      {children}
    </select>
  </div>
);

const PnlListTable: React.FC<{
  transactions: TransactionDetail[];
  sortConfig: { key: keyof TransactionDetail; direction: 'asc' | 'desc' };
  onSort: (key: keyof TransactionDetail) => void;
}> = ({ transactions, sortConfig, onSort }) => {
  const SortableHeader: React.FC<{ sortKey: keyof TransactionDetail; children: React.ReactNode; className?: string; }> = ({ sortKey, children, className }) => {
    const isSorted = sortConfig.key === sortKey;
    const directionIcon = sortConfig.direction === 'asc' ? '▲' : '▼';
    return (
      <th className={`py-3 px-4 ${className || ''}`}>
        <button onClick={() => onSort(sortKey)} className="flex items-center gap-2 uppercase">
          {children}
          <span className="w-4">
            {isSorted ? <span className="text-blue-600 text-xs">{directionIcon}</span> : <span className="text-gray-400 hover:text-gray-600 text-xs inline-flex flex-col leading-3"><span>▲</span><span className="-mt-1">▼</span></span>}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mt-6">
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-100 sticky top-0">
            <tr>
              <SortableHeader sortKey="invoiceNumber">Invoice No.</SortableHeader>
              <SortableHeader sortKey="totalAmount" className="text-right">Sales</SortableHeader>
              <SortableHeader sortKey="totalAmount" className="text-right">Purchases</SortableHeader>
              <SortableHeader sortKey="totalAmount" className="text-right">Profit</SortableHeader>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map(t => (
              <tr key={t.id + t.type} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium">{t.invoiceNumber}</td>
                <td className="py-3 px-4 text-green-600 text-right">
                  {t.type === 'Revenue' ? `₹${t.totalAmount.toLocaleString('en-IN')}` : '-'}
                </td>
                <td className="py-3 px-4 text-red-600 text-right">
                  {t.type === 'Cost' ? `₹${t.totalAmount.toLocaleString('en-IN')}` : '-'}
                </td>
                <td className={`py-3 px-4 text-right font-medium ${t.type === 'Revenue' ? 'text-green-600' : 'text-red-600'}`}>
                  {t.type === 'Revenue' ? `₹${t.totalAmount.toLocaleString('en-IN')}` : `-₹${t.totalAmount.toLocaleString('en-IN')}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
    const qSales = query(salesCollectionRef);
    const qPurchases = query(purchasesCollectionRef);

    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({
        id: doc.id,
        totalAmount: doc.data().totalAmount || 0,
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
        invoiceNumber: doc.data().invoiceNumber || 'N/A',
      })));
    }, (_err) => setError('Failed to fetch sales data.'));

    const unsubscribePurchases = onSnapshot(qPurchases, (snapshot) => {
      setPurchases(snapshot.docs.map(doc => ({
        id: doc.id,
        totalAmount: doc.data().totalAmount || 0,
        createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : new Date(),
        invoiceNumber: doc.data().invoiceNumber || 'N/A',
      })));
      setLoading(false);
    }, (_err) => setError('Failed to fetch purchases data.'));

    return () => {
      unsubscribeSales();
      unsubscribePurchases();
    };
  }, [userId]);

  return { sales, purchases, loading, error };
};


const PnlReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const { sales, purchases, loading: dataLoading, error } = usePnlReport(currentUser?.uid);

  const [datePreset, setDatePreset] = useState<string>('today');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [appliedFilters, setAppliedFilters] = useState({ start: '', end: '' });
  const [isListVisible, setIsListVisible] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof TransactionDetail; direction: 'asc' | 'desc' }>({ key: 'createdAt', direction: 'desc' });

  useEffect(() => {
    const today = new Date();
    const formattedToday = formatDateForInput(today);
    setStartDate(formattedToday);
    setEndDate(formattedToday);

    const startTimestamp = new Date(formattedToday);
    startTimestamp.setHours(0, 0, 0, 0);
    const endTimestamp = new Date(formattedToday);
    endTimestamp.setHours(23, 59, 59, 999);
    setAppliedFilters({ start: startTimestamp.toISOString(), end: endTimestamp.toISOString() });
  }, []);

  const { pnlSummary, filteredTransactions } = useMemo(() => {
    const startTimestamp = appliedFilters.start ? new Date(appliedFilters.start).getTime() : 0;
    const endTimestamp = appliedFilters.end ? new Date(appliedFilters.end).getTime() : Infinity;

    const filteredSales = sales.filter(s => s.createdAt.getTime() >= startTimestamp && s.createdAt.getTime() <= endTimestamp);
    const filteredPurchases = purchases.filter(p => p.createdAt.getTime() >= startTimestamp && p.createdAt.getTime() <= endTimestamp);

    const totalRevenue = filteredSales.reduce((sum, sale) => sum + sale.totalAmount, 0);
    const totalCost = filteredPurchases.reduce((sum, purchase) => sum + purchase.totalAmount, 0);
    const netProfit = totalRevenue - totalCost;

    let combinedTransactions: TransactionDetail[] = [
      ...filteredSales.map(s => ({ ...s, type: 'Revenue' as const })),
      ...filteredPurchases.map(p => ({ ...p, type: 'Cost' as const })),
    ];

    combinedTransactions.sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      const valA = a[key] ?? '';
      const valB = b[key] ?? '';
      if (typeof valA === 'string' && typeof valB === 'string') { return valA.localeCompare(valB) * direction; }
      if (valA instanceof Date && valB instanceof Date) { return (valA.getTime() - valB.getTime()) * direction; }
      if (typeof valA === 'number' && typeof valB === 'number') { return (valA - valB) * direction; }
      return 0;
    });

    return {
      pnlSummary: { totalRevenue, totalCost, netProfit },
      filteredTransactions: combinedTransactions
    };
  }, [sales, purchases, appliedFilters, sortConfig]);

  const handleSort = (key: keyof TransactionDetail) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    let start = new Date();
    let end = new Date();
    switch (preset) {
      case 'today': break;
      case 'yesterday': start.setDate(start.getDate() - 1); end.setDate(end.getDate() - 1); break;
      case 'last7': start.setDate(start.getDate() - 6); break;
      case 'last30': start.setDate(start.getDate() - 29); break;
      case 'custom': return;
    }
    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(end));
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ start: startDate, end: endDate });
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
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex items-center justify-between pb-3 border-b mb-4">
        <h1 className="flex-1 text-xl text-center font-bold text-gray-800">Profit & Loss Report</h1>
        <button onClick={() => navigate(-1)} className="p-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FilterSelect value={datePreset} onChange={(e) => handleDatePresetChange(e.target.value)}>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last7">Last 7 Days</option>
            <option value="last30">Last 30 Days</option>
            <option value="custom">Custom</option>
          </FilterSelect>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full p-2 text-sm bg-gray-50 border border-gray-300 rounded-md"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full p-2 text-sm bg-gray-50 border border-gray-300 rounded-md"
          />
        </div>
        <button
          onClick={handleApplyFilters}
          className="w-full mt-4 px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg shadow-sm hover:bg-blue-700 transition"
        >
          Apply
        </button>
      </div>

      <div className="flex flex-col gap-6">
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

      <div className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center mt-6">
        <h2 className="text-lg font-semibold text-gray-700">Transaction Details</h2>
        <button onClick={() => setIsListVisible(!isListVisible)} className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-md hover:bg-slate-300 transition">
          {isListVisible ? 'Hide List' : 'Show List'}
        </button>
      </div>

      {isListVisible && <PnlListTable transactions={filteredTransactions} sortConfig={sortConfig} onSort={handleSort} />}
    </div>
  );
};

export default PnlReportPage;