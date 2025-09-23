import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
  doc,
  deleteDoc,
  where, // Make sure 'where' is imported
} from 'firebase/firestore';
import { useAuth } from '../context/auth-context';
import { CustomToggle, CustomToggleItem } from '../Components/CustomToggle';
import { CustomCard } from '../Components/CustomCard';
import { CustomButton } from '../Components/CustomButton';
import { Variant, State } from '../enums';
import { Spinner } from '../constants/Spinner';
import { ROUTES } from '../constants/routes.constants';
import { Modal } from '../constants/Modal';

// --- Data Types ---
interface InvoiceItem {
  name: string;
  quantity: number;
  finalPrice: number;
  mrp: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  time: string;
  status: 'Paid' | 'Unpaid';
  type: 'Debit' | 'Credit';
  partyName: string;
  createdAt: Date;
  dueAmount?: number;
  items?: InvoiceItem[];
}

const formatDate = (date: Date): string => {
  if (!date) return 'N/A';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Custom hook to fetch sales and purchase data for a specific company.
 * @param companyId The ID of the company to fetch transactions for.
 */
const useJournalData = (companyId?: string) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // --- FIX 1: Wait for companyId before running the query ---
    if (!companyId) {
      setLoading(false);
      setInvoices([]); // Clear invoices if no companyId
      return;
    }

    // --- FIX 2: Add a 'where' clause to filter by companyId for both queries ---
    const salesQuery = query(collection(db, 'sales'), where('companyId', '==', companyId));
    const purchasesQuery = query(collection(db, 'purchases'), where('companyId', '==', companyId));

    const processSnapshot = (snapshot: QuerySnapshot, type: 'Credit' | 'Debit'): Invoice[] => {
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date();
        const paymentMethods = data.paymentMethods || {};
        const dueAmount = paymentMethods.due || 0;
        const status: 'Paid' | 'Unpaid' = dueAmount > 0 ? 'Unpaid' : 'Paid';
        const items = (data.items || []).map((item: any) => ({
          name: item.name || 'N/A',
          quantity: item.quantity || 0,
          finalPrice: type === 'Credit' ? (item.finalPrice || 0) : (item.purchasePrice || 0),
          mrp: item.mrp || 0,
        }));

        return {
          id: doc.id,
          invoiceNumber: data.invoiceNumber || `#${doc.id.slice(0, 6).toUpperCase()}`,
          amount: data.totalAmount || 0,
          time: formatDate(createdAt),
          status: status,
          type: type,
          partyName: data.partyName || 'N/A',
          createdAt,
          dueAmount: dueAmount,
          items: items,
        };
      });
    };

    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      const salesData = processSnapshot(snapshot, 'Credit');
      // A safer way to update state to prevent race conditions
      setInvoices((prev) => [...prev.filter((inv) => inv.type !== 'Credit'), ...salesData]);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching sales:", err);
      setError("Failed to load sales data.");
      setLoading(false);
    });

    const unsubscribePurchases = onSnapshot(purchasesQuery, (snapshot) => {
      const purchasesData = processSnapshot(snapshot, 'Debit');
      setInvoices((prev) => [...prev.filter((inv) => inv.type !== 'Debit'), ...purchasesData]);
      setLoading(false);
    },
      (err) => {
        console.error("Error fetching purchases:", err);
        setError("Failed to load purchase data.");
        setLoading(false);
      });

    return () => {
      unsubscribeSales();
      unsubscribePurchases();
    };
    // --- FIX 3: Add companyId to the dependency array ---
  }, [companyId]);

  const sortedInvoices = useMemo(() => {
    return invoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [invoices]);

  return { invoices: sortedInvoices, loading, error };
};


// --- Main Journal Component ---
const Journal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Paid' | 'Unpaid'>('Paid');
  const [activeType, setActiveType] = useState<'Debit' | 'Credit'>('Credit');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeDateFilter, setActiveDateFilter] = useState<string>('today');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const { currentUser, loading: authLoading } = useAuth();
  // --- FIX 4: Pass currentUser.companyId to the hook ---
  const { invoices, loading: dataLoading, error } = useJournalData(currentUser?.companyId);

  // ++ ADDED: Navigation hook ++
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredInvoices = useMemo(() => {
    // ... filtering logic remains the same ...
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return invoices
      .filter((invoice) => {
        if (activeDateFilter === 'all') return true;
        const invoiceDate = invoice.createdAt;
        const daysAgo = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - days);
        switch (activeDateFilter) {
          case 'today': return invoiceDate >= today;
          case 'yesterday': return invoiceDate >= daysAgo(today, 1) && invoiceDate < today;
          case 'last7': return invoiceDate >= daysAgo(today, 7);
          case 'last15': return invoiceDate >= daysAgo(today, 15);
          case 'last30': return invoiceDate >= daysAgo(today, 30);
          default: return true;
        }
      })
      .filter((invoice) =>
        invoice.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter(
        (invoice) =>
          invoice.type === activeType && invoice.status === activeTab
      );
  }, [invoices, activeType, activeTab, searchQuery, activeDateFilter]);

  const dateFilters = [
    { label: 'All Time', value: 'all' },
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'last7' },
    { label: 'Last 15 Days', value: 'last15' },
    { label: 'Last 30 Days', value: 'last30' },
  ];

  const handleDateFilterSelect = (value: string) => {
    setActiveDateFilter(value);
    setIsFilterOpen(false);
  };

  const handleInvoiceClick = (invoiceId: string) => {
    setExpandedInvoiceId(prevId => (prevId === invoiceId ? null : invoiceId));
  };

  const promptDeleteInvoice = (invoice: Invoice) => {
    setInvoiceToDelete(invoice);
    setModal({ message: "Are you sure you want to delete this invoice? This action cannot be undone.", type: State.INFO });
  };

  const confirmDeleteInvoice = async () => {
    if (!invoiceToDelete) return;
    try {
      const collectionName = invoiceToDelete.type === 'Credit' ? 'sales' : 'purchases';
      await deleteDoc(doc(db, collectionName, invoiceToDelete.id));
    } catch (err) {
      console.error("Error deleting invoice: ", err);
      alert("Failed to delete invoice.");
    } finally {
      setInvoiceToDelete(null);
      setModal(null);
    }
  };

  const cancelDelete = () => {
    setInvoiceToDelete(null);
    setModal(null);
  };

  const handleSalesReturn = (invoice: Invoice) => {
    navigate(`${ROUTES.SALES_RETURN}`, { state: { invoiceData: invoice } });
  };

  const handlePurchaseReturn = (invoice: Invoice) => {
    navigate(`${ROUTES.PURCHASE_RETURN}`, { state: { invoiceData: invoice } });
  };

  const renderContent = () => {
    if (authLoading || dataLoading) {
      return <Spinner />;
    }
    if (error) {
      return <p className="p-8 text-center text-red-500">{error}</p>;
    }
    if (filteredInvoices.length > 0) {
      return filteredInvoices.map((invoice) => {
        const isExpanded = expandedInvoiceId === invoice.id;
        return (
          <CustomCard
            key={invoice.id}
            onClick={() => handleInvoiceClick(invoice.id)}
            className="cursor-pointer transition-shadow hover:shadow-md"
          >
            {/* ++ MODIFIED: Arrow position reverted to the top right ++ */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-semibold text-slate-800">{invoice.invoiceNumber}</p>
                <p className="text-sm text-slate-500 mt-1">{invoice.partyName}</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-lg font-bold text-slate-800">
                    {invoice.amount.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                  </p>
                  <p className="text-xs text-slate-500">{invoice.time}</p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className={`w-5 h-5 text-slate-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </div>

            {isExpanded && (
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">Items</h4>
                <div className="space-y-2 text-sm">
                  {(invoice.items && invoice.items.length > 0) ? invoice.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-center text-slate-700">
                      <div className="flex-1 pr-4">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-slate-400">
                          MRP: {item.mrp.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {item.finalPrice.toLocaleString('en-IN', { style: 'currency', currency: 'INR' })}
                        </p>
                        <p className="text-xs text-slate-400">Qty: {item.quantity}</p>
                      </div>
                    </div>
                  )) : <p className="text-xs text-slate-400">No item details available.</p>}
                </div>

                <div className="flex justify-end space-x-3 mt-4 pt-4 border-t border-slate-200">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      promptDeleteInvoice(invoice);
                    }}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    Delete
                  </button>
                  {invoice.type === 'Credit' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSalesReturn(invoice);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                    >
                      Sales Return
                    </button>
                  )}
                  {invoice.type === 'Debit' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePurchaseReturn(invoice);
                      }}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors"
                    >
                      Purchase Return
                    </button>
                  )}
                </div>
              </div>
            )}
          </CustomCard>
        );
      });
    }
    return (
      <p className="p-8 text-center text-base text-slate-500">
        No invoices found for this selection.
      </p>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-hidden bg-white shadow-md">
      {modal && (
        <Modal
          message={modal.message}
          type={modal.type}
          onClose={cancelDelete}
          onConfirm={confirmDeleteInvoice}
          showConfirmButton={true}
        />
      )}
      <div className="flex items-center justify-between p-4 px-6">
        <div className="flex flex-1 items-center">
          <button onClick={() => setShowSearch(!showSearch)} className="text-slate-500 hover:text-slate-800 transition-colors mr-4">
            {showSearch ? (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            )}
          </button>
          <div className="flex-1">
            {!showSearch && <h1 className="text-4xl font-light text-slate-800">Transactions</h1>}
            {showSearch && (
              <input
                type="text"
                placeholder="Search by Invoice No..."
                className="w-full text-xl font-light p-1 border-b-2 border-slate-300 focus:border-slate-800 outline-none transition-colors"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            )}
          </div>
        </div>
        <div className="relative pl-4" ref={filterRef}>
          <button onClick={() => setIsFilterOpen(!isFilterOpen)} className="text-slate-500 hover:text-slate-800 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.572a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" /></svg>
          </button>
          {isFilterOpen && (
            <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border">
              <ul className="py-1">
                {dateFilters.map((filter) => (
                  <li key={filter.value}>
                    <button
                      onClick={() => handleDateFilterSelect(filter.value)}
                      className={`w-full text-left px-4 py-2 text-sm ${activeDateFilter === filter.value ? 'bg-slate-100 text-slate-900' : 'text-slate-700'} hover:bg-slate-50`}
                    >
                      {filter.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-center border-b border-gray-500 p-2 mb-4">
        <CustomButton variant={Variant.Transparent} active={activeType === 'Credit'} onClick={() => setActiveType('Credit')}>Sales</CustomButton>
        <CustomButton variant={Variant.Transparent} active={activeType === 'Debit'} onClick={() => setActiveType('Debit')}>Purchase</CustomButton>
      </div>
      <CustomToggle>
        <CustomToggleItem className="mr-2" onClick={() => setActiveTab('Paid')} data-state={activeTab === 'Paid' ? 'on' : 'off'}>Paid</CustomToggleItem>
        <CustomToggleItem onClick={() => setActiveTab('Unpaid')} data-state={activeTab === 'Unpaid' ? 'on' : 'off'}>Unpaid</CustomToggleItem>
      </CustomToggle>
      <div className="flex-grow overflow-y-auto bg-slate-100 p-6 space-y-3">
        {renderContent()}
      </div>
    </div >
  );
};

export default Journal;
