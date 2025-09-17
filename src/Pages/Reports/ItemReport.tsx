import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getItems } from '../../lib/items_firebase';
import type { Item } from '../../constants/models';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


const SummaryCard: React.FC<{ title: string; value: string }> = ({
  title,
  value,
}) => (
  <div className="bg-white p-4 rounded-lg shadow-md text-center">
    <h3 className="text-xs font-medium text-gray-500">{title}</h3>
    <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
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

const ItemListTable: React.FC<{
  items: Item[];
  sortConfig: { key: keyof Item; direction: 'asc' | 'desc' };
  onSort: (key: keyof Item) => void;
}> = ({ items, sortConfig, onSort }) => {

  const SortableHeader: React.FC<{ sortKey: keyof Item; children: React.ReactNode; className?: string; }> = ({ sortKey, children, className }) => {
    const isSorted = sortConfig.key === sortKey;
    const directionIcon = sortConfig.direction === 'asc' ? '▲' : '▼';

    return (
      <th className={`py-3 px-4 ${className || ''}`}>
        <button onClick={() => onSort(sortKey)} className="flex items-center gap-2 uppercase">
          {children}
          {/* MODIFIED: This span now ensures an icon is always visible */}
          <span className="w-4">
            {isSorted ? (
              <span className="text-blue-600 text-xs">{directionIcon}</span>
            ) : (
              <span className="text-gray-400 hover:text-gray-600 text-xs inline-flex flex-col leading-3">
                <span>▲</span>
                <span className="-mt-1">▼</span>
              </span>
            )}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow-md mt-6">
      <h2 className="text-lg font-semibold text-gray-700 mb-4">Filtered Items List</h2>
      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 bg-slate-100 sticky top-0">
            <tr>
              <SortableHeader sortKey="name">Item Name</SortableHeader>
              <th className="py-3 px-4 uppercase">Item Group</th>
              <SortableHeader sortKey="mrp" className="text-right">MRP</SortableHeader>
              <SortableHeader sortKey="purchasePrice" className="text-right">Purchase Price</SortableHeader>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map(item => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="py-3 px-4 font-medium">{item.name}</td>
                <td className="py-3 px-4 text-slate-600">{item.itemGroupId || 'N/A'}</td>
                <td className="py-3 px-4 text-slate-600 text-right">₹{item.mrp?.toFixed(2) || '0.00'}</td>
                <td className="py-3 px-4 text-slate-600 text-right">₹{item.purchasePrice?.toFixed(2) || '0.00'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ItemReport: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // State for filter dropdowns (temporary values)
  const [itemGroupId, setItemGroupId] = useState<string>('');

  // State for sorting (applies instantly)
  const [sortConfig, setSortConfig] = useState<{ key: keyof Item; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // State to hold the filters after clicking "Apply"
  const [appliedItemGroupId, setAppliedItemGroupId] = useState<string>('');

  const [isListVisible, setIsListVisible] = useState(false);

  useEffect(() => {
    const fetchAllItems = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await getItems();
        setItems(fetchedItems);
      } catch (err) {
        setError('Failed to load item data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllItems();
  }, []);

  const { filteredItems, summary, uniqueItemGroupIds } = useMemo(() => {
    let newFilteredItems = [...items];
    const allItemGroupIds = [...new Set(items.map((item) => item.itemGroupId || 'Uncategorized'))];

    if (appliedItemGroupId) {
      newFilteredItems = newFilteredItems.filter(
        (item) => (item.itemGroupId || 'Uncategorized') === appliedItemGroupId
      );
    }

    newFilteredItems.sort((a, b) => {
      const key = sortConfig.key;
      const direction = sortConfig.direction === 'asc' ? 1 : -1;

      const valA = a[key] === null || a[key] === undefined ? '' : a[key];
      const valB = b[key] === null || b[key] === undefined ? '' : b[key];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return valA.localeCompare(valB) * direction;
      }
      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * direction;
      }
      return 0;
    });

    const totalItems = newFilteredItems.length;
    const totalMrp = newFilteredItems.reduce((sum, item) => sum + (item.mrp || 0), 0);
    const totalPurchasePrice = newFilteredItems.reduce((sum, item) => sum + (item.purchasePrice || 0), 0);
    const totalDiscount = newFilteredItems.reduce((sum, item) => sum + (item.discount || 0), 0);
    const averageMrp = totalItems > 0 ? totalMrp / totalItems : 0;
    const averagePurchasePrice = totalItems > 0 ? totalPurchasePrice / totalItems : 0;
    const averageDiscount = totalItems > 0 ? totalDiscount / totalItems : 0;
    const averageSalePrice = averageMrp - (averageMrp * (averageDiscount / 100));
    const averageprofitmargin = averageSalePrice - averagePurchasePrice;
    const averagemarginpercentage = averageprofitmargin / averageSalePrice * 100;

    return {
      filteredItems: newFilteredItems,
      summary: { totalItems, averageMrp, averagePurchasePrice, averageSalePrice, averageprofitmargin, averagemarginpercentage },
      uniqueItemGroupIds: allItemGroupIds,
    };
  }, [appliedItemGroupId, sortConfig, items]);

  const handleApplyFilters = () => {
    setAppliedItemGroupId(itemGroupId);
  };

  const handleSort = (key: keyof Item) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const downloadAsPdf = () => {
    const doc = new jsPDF();
    doc.text('Item Report', 20, 10);
    autoTable(doc, {
      head: [['Item Name', 'Item Group', 'MRP', 'Discount', 'Purchase Price']],
      body: filteredItems.map((item) => [
        item.name,
        item.itemGroupId || 'N/A',
        `₹${item.mrp?.toFixed(2) || 'N/A'}`,
        `${item.discount || 0}%`,
        `₹${item.purchasePrice?.toFixed(2) || 'N/A'}`,
      ]),
    });
    doc.save('item_report.pdf');
  };

  if (isLoading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4 text-red-500">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="flex items-center justify-between pb-3 border-b mb-4">
        <h1 className="flex-1 text-xl text-center font-bold text-gray-800">Item Report</h1>
        <button onClick={() => navigate(-1)} className="rounded-full bg-gray-200 p-2 text-gray-900">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="bg-white p-3 rounded-lg shadow-md mb-4">
        <h2 className="text-center font-semibold text-gray-700 mb-2">FILTERS</h2>
        <div className="flex space-x-3 items-end">
          <FilterSelect label="Item Group" value={itemGroupId} onChange={(e) => setItemGroupId(e.target.value)}>
            <option value="">All Groups</option>
            {uniqueItemGroupIds.map((id) => (<option key={id} value={id}>{id}</option>))}
          </FilterSelect>
          <button onClick={handleApplyFilters} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 transition">
            Apply
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <SummaryCard title="Total Items (Filtered)" value={summary.totalItems.toString()} />
        <SummaryCard title="Average MRP (Filtered)" value={`₹${summary.averageMrp.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
        <SummaryCard title="Avg. Purchase Price (Filtered)" value={`₹${summary.averagePurchasePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
        <SummaryCard title="Average Sale Price" value={`₹${summary.averageSalePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} />
        <SummaryCard title="Average Profit Margin" value={`${summary.averageprofitmargin.toLocaleString('en-IN', { minimumFractionDigits: 2 })} `} />
        <SummaryCard title="Average Margin Percentage" value={`${summary.averagemarginpercentage.toLocaleString('en-IN', { minimumFractionDigits: 2 })} %`} />
      </div>

      <div className="bg-white p-4 rounded-lg shadow-md flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Report Details</h2>
        <div className="flex items-center space-x-3">
          <button onClick={() => setIsListVisible(!isListVisible)} className="px-4 py-2 bg-slate-200 text-slate-800 font-semibold rounded-md hover:bg-slate-300 transition">
            {isListVisible ? 'Hide List' : 'Show List'}
          </button>
          <button onClick={downloadAsPdf} disabled={filteredItems.length === 0} className="bg-blue-600 text-white font-semibold rounded-md py-2 px-4 shadow-sm hover:bg-blue-700 disabled:opacity-50">
            Download PDF
          </button>
        </div>
      </div>

      {isListVisible && <ItemListTable items={filteredItems} sortConfig={sortConfig} onSort={handleSort} />}
    </div>
  );
};

export default ItemReport;