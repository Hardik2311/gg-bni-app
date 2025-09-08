import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Data Types ---
interface SalesItem {
  name: string;
  mrp: number;
  quantity: number;
}
interface PaymentMethods {
  [key: string]: number;
}
interface SaleRecord {
  id: string;
  partyName: string;
  totalAmount: number;
  paymentMethods: PaymentMethods;
  createdAt: number;
  items: SalesItem[];
}

// --- Helper Functions ---
const formatDate = (timestamp: number): string => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// --- Reusable Components (to match other reports) ---
const SummaryCard: React.FC<{ title: string; value: string; note?: string }> =
  ({ title, value, note }) => (
    <div className="bg-white p-4 rounded-lg shadow-md text-center">
      <h3 className="text-xs font-medium text-gray-500">{title}</h3>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
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

const FilterSelect: React.FC<{
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}> = ({ label, value, onChange, children }) => (
  <div className="flex-1 min-w-0">
    <label className="block text-xs text-center font-medium text-gray-600 mb-1">
      {label}
    </label>
    <select
      value={value}
      onChange={onChange}
      className="w-full p-2 text-sm text-center bg-gray-50 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
    >
      {children}
    </select>
  </div>
);

// --- Main Sales Report Component ---
const SalesReport: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'date' | 'asc' | 'desc'>('date');

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setIsLoading(false);
      setError('You must be logged in to view sales reports.');
      return;
    }

    const fetchSales = async () => {
      setIsLoading(true);
      try {
        const salesCollection = collection(db, 'sales');
        const q = query(salesCollection);
        const querySnapshot = await getDocs(q);
        const fetchedSales: SaleRecord[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            partyName: data.partyName || 'N/A',
            totalAmount: data.totalAmount || 0,
            paymentMethods: data.paymentMethods || {},
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
            items: data.items || [],
          };
        });
        setSales(fetchedSales);
      } catch (err) {
        console.error('Failed to fetch sales data:', err);
        setError('Failed to load sales report. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchSales();
  }, [currentUser, authLoading]);

  const { filteredSales, summary } = useMemo(() => {
    let newFilteredSales = [...sales];

    if (searchQuery) {
      newFilteredSales = newFilteredSales.filter((sale) =>
        sale.partyName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (startDate || endDate) {
      const startTimestamp = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : 0;
      const endTimestamp = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : Infinity;
      newFilteredSales = newFilteredSales.filter((sale) => {
        const saleCreatedAt = sale.createdAt;
        return saleCreatedAt >= startTimestamp && saleCreatedAt <= endTimestamp;
      });
    }

    newFilteredSales.sort((a, b) => {
      if (sortOrder === 'date') {
        return b.createdAt - a.createdAt; // Newest first
      }
      const nameA = a.partyName.toLowerCase();
      const nameB = b.partyName.toLowerCase();
      return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });

    const totalSales = newFilteredSales.reduce((acc, sale) => acc + sale.totalAmount, 0);
    const totalTransactions = newFilteredSales.length;

    const customerTotals: { [key: string]: number } = {};
    newFilteredSales.forEach((s) => {
      customerTotals[s.partyName] = (customerTotals[s.partyName] || 0) + s.totalAmount;
    });
    const topCustomerData = Object.entries(customerTotals).sort((a, b) => b[1] - a[1])[0] || null;

    return {
      filteredSales: newFilteredSales,
      summary: { totalSales, totalTransactions, topCustomer: topCustomerData },
    };
  }, [searchQuery, startDate, endDate, sortOrder, sales]);

  const downloadAsPdf = () => {
    const doc = new jsPDF();
    doc.text('Sales Report', 20, 10);
    autoTable(doc, {
      head: [['Date', 'Party Name', 'Total Amount', 'Payment Method']],
      body: filteredSales.map((sale) => [
        formatDate(sale.createdAt),
        sale.partyName,
        `₹${sale.totalAmount.toLocaleString('en-IN')}`,
        Object.keys(sale.paymentMethods).join(', ') || 'N/A',
      ]),
    });
    doc.save('sales_report.pdf');
  };

  if (isLoading || authLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }
  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* --- Header --- */}
      <div className="flex items-center justify-between pb-3 border-b mb-4">
        <h1 className="flex-1 text-xl text-center font-bold text-gray-800">
          Sales Report
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-gray-200 p-2 text-gray-700"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      {/* --- Main Filters Section (New Layout) --- */}
      <div className="bg-white p-3 rounded-lg shadow-md mb-4">
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
          <FilterInput
            label="Party Name"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <FilterSelect
            label="Sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'date' | 'asc' | 'desc')}
          >
            <option value="date">Newest</option>
            <option value="asc">A-Z</option>
            <option value="desc">Z-A</option>
          </FilterSelect>
        </div>
      </div>

      {/* --- Summary Cards Section (2x2 Layout) --- */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <SummaryCard
          title="Total Sales (Filtered)"
          value={`₹${summary.totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
        />
        <SummaryCard
          title="Total Transactions"
          value={summary.totalTransactions.toString()}
        />
        <SummaryCard
          title="Top Customer (Filtered)"
          value={summary.topCustomer ? summary.topCustomer[0] : 'N/A'}
          note={
            summary.topCustomer
              ? `Total: ₹${summary.topCustomer[1].toLocaleString('en-IN')}`
              : ''
          }
        />
        {/* Empty card for layout balance */}
        <div className="p-4" />
      </div>

      {/* --- Download Section (New Layout) --- */}
      <div className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Report Details</h2>
        <button
          onClick={downloadAsPdf}
          disabled={filteredSales.length === 0}
          className="bg-blue-600 text-white font-semibold rounded-md py-2 px-4 shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
};

export default SalesReport;