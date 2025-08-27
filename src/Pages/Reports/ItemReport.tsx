import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getItems } from '../../lib/items_firebase';
import type { Item } from '../../constants/models';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- Helper Functions ---
const formatDate = (timestamp: number | null): string => {
  if (!timestamp) return 'N/A';
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// --- Reusable Components ---
const SummaryCard: React.FC<{ title: string; value: string }> = ({
  title,
  value,
}) => (
  <div className="bg-white p-4 rounded-lg shadow-md text-center">
    <h3 className="text-xs font-medium text-gray-500">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
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

// --- Main Component ---
const ItemReport: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchAllItems = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await getItems();
        setItems(fetchedItems);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch items:', err);
        setError('Failed to load item data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllItems();
  }, []);

  const { filteredItems, summary, uniqueCategories } = useMemo(() => {
    let newFilteredItems = [...items]; // Create a mutable copy

    // Get unique categories for the dropdown
    const allCategories = [
      ...new Set(items.map((item) => item.category || 'Uncategorized')),
    ];

    // Apply category filter
    if (category) {
      newFilteredItems = newFilteredItems.filter(
        (item) => (item.category || 'Uncategorized') === category
      );
    }

    // Apply date range filter
    if (startDate || endDate) {
      const startTimestamp = startDate
        ? new Date(startDate).setHours(0, 0, 0, 0)
        : 0;
      const endTimestamp = endDate
        ? new Date(endDate).setHours(23, 59, 59, 999)
        : Infinity;
      newFilteredItems = newFilteredItems.filter((item) => {
        const itemCreatedAt = item.createdAt;
        return itemCreatedAt && itemCreatedAt >= startTimestamp && itemCreatedAt <= endTimestamp;
      });
    }

    // Apply sorting
    newFilteredItems.sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      if (sortOrder === 'asc') {
        return nameA.localeCompare(nameB);
      } else {
        return nameB.localeCompare(nameA);
      }
    });

    // Calculate summary statistics from the filtered and sorted data
    const totalItems = newFilteredItems.length;
    const totalMrp = newFilteredItems.reduce((sum, item) => sum + (item.mrp || 0), 0);
    const totalPurchasePrice = newFilteredItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const averageMrp = totalItems > 0 ? totalMrp / totalItems : 0;
    const averagePurchasePrice = totalItems > 0 ? totalPurchasePrice / totalItems : 0;

    return {
      filteredItems: newFilteredItems,
      summary: { totalItems, averageMrp, averagePurchasePrice },
      uniqueCategories: allCategories,
    };
  }, [startDate, endDate, category, sortOrder, items]);

  const downloadAsPdf = () => {
    const doc = new jsPDF();
    doc.text('Item Report', 20, 10);
    autoTable(doc, {
      head: [['Item Name', 'Category', 'MRP', 'Purchase Price', 'Created At']],
      body: filteredItems.map((item) => [
        item.name,
        item.category || 'N/A',
        `₹${item.mrp?.toFixed(2) || 'N/A'}`,
        `₹${item.purchasePrice?.toFixed(2) || 'N/A'}`,
        formatDate(item.createdAt || null),
      ]),
    });
    doc.save('item_report.pdf');
  };

  if (isLoading) {
    return <div className="p-4">Loading...</div>;
  }
  if (error) {
    return <div className="p-4 text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* --- Header --- */}
      <div className="flex items-center justify-between pb-3 border-b mb-4">
        <h1 className="flex-1 text-xl text-center font-bold text-gray-800">
          Item Report
        </h1>
        <button
          onClick={() => navigate(-1)}
          className="rounded-full bg-gray-200 p-2 text-gray-900"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* --- Main Filters Section (As per image) --- */}
      <div className="bg-white p-3 rounded-lg shadow-md mb-4">
        <h2 className="text-center font-semibold text-gray-700 mb-2">FILTERS</h2>
        <div className="flex space-x-2">
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
          <FilterSelect
            label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All</option>
            {uniqueCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="Sort"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          >
            <option value="asc">A-Z</option>
            <option value="desc">Z-A</option>
          </FilterSelect>
        </div>
      </div>

      {/* --- Summary Cards Section --- */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <SummaryCard
          title="Total Items (Filtered)"
          value={summary.totalItems.toString()}
        />
        <SummaryCard
          title="Average MRP (Filtered)"
          value={`₹${summary.averageMrp.toFixed(2)}`}
        />
        <SummaryCard
          title="Avg. Purchase Price (Filtered)"
          value={`₹${summary.averagePurchasePrice.toFixed(2)}`}
        />
        {/* Empty card for layout, or add another metric */}
        <div className="p-4" />
      </div>

      {/* --- Download Section --- */}
      <div className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Report Details</h2>
        <button
          onClick={downloadAsPdf}
          disabled={filteredItems.length === 0}
          className="bg-blue-600 text-white font-semibold rounded-md py-2 px-4 shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
};

export default ItemReport;