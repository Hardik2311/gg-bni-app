import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
} from 'firebase/firestore'; // Import QuerySnapshot
import { useAuth } from '../context/auth-context';
import { CustomToggle, CustomToggleItem } from '../Components/CustomToggle';
import { CustomCard } from '../Components/CustomCard';
import { CustomButton } from '../Components/CustomButton';
import { Variant } from '../enums';
import { Spinner } from '../constants/Spinner';

// --- Data Types & Helpers ---
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
}

const formatDate = (date: Date): string => {
  if (!date) return 'N/A';
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// --- Custom Hook for Fetching Journal Data ---
const useJournalData = (userId?: string) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const salesQuery = query(
      collection(db, 'sales')
    );
    const purchasesQuery = query(
      collection(db, 'purchases')
    );

    const handleSnapshotError = (err: Error, type: string) => {
      console.error(`Error fetching ${type}:`, err);
      setError(`Failed to load ${type} data.`);
      setLoading(false);
    };

    const processSnapshot = (
      snapshot: QuerySnapshot,
      type: 'Credit' | 'Debit',
    ) => {
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const createdAt =
          data.createdAt instanceof Timestamp
            ? data.createdAt.toDate()
            : new Date();
        const paymentMethods = data.paymentMethods || {};
        const dueAmount = paymentMethods.due || 0;
        const status: 'Paid' | 'Unpaid' = dueAmount > 0 ? 'Unpaid' : 'Paid';

        return {
          id: doc.id,
          // FIX: Read the invoiceNumber from the document, with a fallback
          invoiceNumber: data.invoiceNumber || `#${doc.id.slice(0, 6).toUpperCase()}`,
          amount: data.totalAmount || 0,
          time: formatDate(createdAt),
          status: status,
          type: type,
          partyName: data.partyName || 'N/A',
          createdAt,
          dueAmount: dueAmount,
        };
      });
    };

    const unsubscribeSales = onSnapshot(
      salesQuery,
      (snapshot) => {
        const salesData = processSnapshot(snapshot, 'Credit');
        setInvoices((prev) => [
          ...prev.filter((inv) => inv.type !== 'Credit'),
          ...salesData,
        ]);
        setLoading(false);
      },
      (err) => handleSnapshotError(err, 'sales'),
    );

    const unsubscribePurchases = onSnapshot(
      purchasesQuery,
      (snapshot) => {
        const purchasesData = processSnapshot(snapshot, 'Debit');
        setInvoices((prev) => [
          ...prev.filter((inv) => inv.type !== 'Debit'),
          ...purchasesData,
        ]);
        setLoading(false);
      },
      (err) => handleSnapshotError(err, 'purchases'),
    );

    return () => {
      unsubscribeSales();
      unsubscribePurchases();
    };
  }, [userId]);

  const sortedInvoices = useMemo(() => {
    return invoices.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }, [invoices]);

  return { invoices: sortedInvoices, loading, error };
};

// --- Main Journal Component ---
const Journal: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Paid' | 'Unpaid'>('Paid');
  const [activeType, setActiveType] = useState<'Debit' | 'Credit'>('Credit');
  const { currentUser, loading: authLoading } = useAuth();
  const {
    invoices,
    loading: dataLoading,
    error,
  } = useJournalData(currentUser?.uid);

  const filteredInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          invoice.type === activeType && invoice.status === activeTab,
      ),
    [invoices, activeType, activeTab],
  );

  const renderContent = () => {
    if (authLoading || dataLoading) {
      return <Spinner />;
    }
    if (error) {
      return <p className="p-8 text-center text-red-500">{error}</p>;
    }
    if (filteredInvoices.length > 0) {
      return filteredInvoices.map((invoice) => (
        <CustomCard key={invoice.id}>
          <div className="flex items-center justify-between">
            <p className="text-base font-semibold text-slate-800">
              {invoice.invoiceNumber}
            </p>
            <p className="text-sm text-slate-500">
              {invoice.time}
            </p>
          </div>
          <p className="text-sm text-slate-800 mt-2">{invoice.partyName}</p>
          <div className="flex justify-end -mt-6">
            <p className="text-lg font-bold text-slate-800">
              {invoice.amount.toLocaleString('en-IN', {
                style: 'currency',
                currency: 'INR',
              })}
            </p>
          </div>
        </CustomCard>
      ));
    }

    return (
      <p className="p-8 text-center text-base text-slate-500">
        No invoices found for this selection.
      </p>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-hidden bg-white shadow-md">
      {/* Top Header */}
      <div className="flex items-center justify-center p-4 px-6">
        <h1 className="text-4xl font-light text-slate-800 ">Transactions</h1>
      </div>

      {/* Debit/Credit Tabs */}
      <div className="flex justify-center border-b border-gray-500 p-2 mb-4">
        <CustomButton
          variant={Variant.Transparent}
          active={activeType === 'Credit'}
          onClick={() => setActiveType('Credit')}
        >
          Sales
        </CustomButton>
        <CustomButton
          variant={Variant.Transparent}
          active={activeType === 'Debit'}
          onClick={() => setActiveType('Debit')}
        >
          Purchase
        </CustomButton>
      </div>
      {/* Filter Tabs */}
      <CustomToggle>
        <CustomToggleItem
          className="mr-2"
          onClick={() => setActiveTab('Paid')}
          data-state={activeTab === 'Paid' ? 'on' : 'off'}
        >
          Paid
        </CustomToggleItem>
        <CustomToggleItem
          onClick={() => setActiveTab('Unpaid')}
          data-state={activeTab === 'Unpaid' ? 'on' : 'off'}
        >
          Unpaid
        </CustomToggleItem>
      </CustomToggle>
      {/* Invoice List */}
      <div className="flex-grow overflow-y-auto bg-slate-100 p-6 space-y-3">
        {renderContent()}
      </div>
    </div >
  );
};

export default Journal;