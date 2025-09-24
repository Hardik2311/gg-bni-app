import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, NavLink, useParams, useLocation } from 'react-router-dom';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  getDocs,
  serverTimestamp,
  doc,
  writeBatch,
  increment as firebaseIncrement,
  arrayUnion,
  where,
} from 'firebase/firestore';
import { useAuth, useDatabase } from '../../context/auth-context';
import { ROUTES } from '../../constants/routes.constants';
import type { Item, PurchaseItem as OriginalPurchaseItem } from '../../constants/models';
import { Modal } from '../../constants/Modal';
import { State, Variant } from '../../enums';
import { CustomButton } from '../../Components';
import SearchableItemInput from '../../UseComponents/SearchIteminput';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';

// --- Interfaces ---
interface PurchaseData {
  id: string;
  invoiceNumber: string;
  partyName: string;
  partyNumber?: string;
  items: OriginalPurchaseItem[];
  totalAmount: number;
  createdAt: any;
  isReturned?: boolean;
}
interface TransactionItem {
  id: string;
  originalItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

// --- Main Purchase Return Page Component ---
const PurchaseReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const dbOperations = useDatabase();
  const { purchaseId } = useParams();
  const { state } = useLocation();

  const [modeOfReturn, setModeOfReturn] = useState<string>('Exchange');
  const [itemsToReturn, setItemsToReturn] = useState<TransactionItem[]>([]);
  const [newItemsReceived, setNewItemsReceived] = useState<TransactionItem[]>([]);

  const [purchaseList, setPurchaseList] = useState<PurchaseData[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [scannerPurpose, setScannerPurpose] = useState<'purchase' | 'item' | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!currentUser || !currentUser.companyId || !dbOperations) {
      setIsLoading(false);
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const purchasesQuery = query(
          collection(db, 'purchases'),
          where('companyId', '==', currentUser.companyId)
        );
        const [purchasesSnapshot, allItems] = await Promise.all([
          getDocs(purchasesQuery),
          dbOperations.getItems()
        ]);

        const purchases: PurchaseData[] = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseData));
        setPurchaseList(purchases);
        setAvailableItems(allItems);

        if (state?.invoiceData) {
          handleSelectPurchase(state.invoiceData);
        } else if (purchaseId) {
          const preselectedPurchase = purchases.find(p => p.id === purchaseId);
          if (preselectedPurchase) {
            handleSelectPurchase(preselectedPurchase);
          } else {
            setError(`Purchase with ID ${purchaseId} not found.`);
          }
        }
      } catch (err) {
        setError('Failed to load initial data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser, dbOperations, purchaseId, state]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredList = useMemo(() => purchaseList
    .filter(p => !p.isReturned)
    .filter(p =>
      p.partyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)),
    [purchaseList, searchQuery]
  );

  const handleSelectPurchase = (purchase: PurchaseData) => {
    setSelectedPurchase(purchase);
    setItemsToReturn(purchase.items.map((item: any) => ({
      id: crypto.randomUUID(),
      originalItemId: item.id,
      name: item.name,
      quantity: item.quantity || 1,
      unitPrice: item.purchasePrice || 0,
      amount: (item.purchasePrice || 0) * (item.quantity || 1),
    })));
    setNewItemsReceived([]);
    setSearchQuery(purchase.invoiceNumber || purchase.partyName);
    setIsDropdownOpen(false);
  };

  const handleClear = () => {
    setSelectedPurchase(null);
    setItemsToReturn([]);
    setNewItemsReceived([]);
    setSearchQuery('');
    navigate(ROUTES.PURCHASE_RETURN);
  };

  const handleItemReceived = (item: Item) => {
    if (!item) return;
    setNewItemsReceived(prev => [...prev, {
      id: crypto.randomUUID(),
      originalItemId: item.id!,
      name: item.name,
      quantity: 1,
      unitPrice: item.purchasePrice || 0,
      amount: item.purchasePrice || 0,
    }]);
  };

  const handleBarcodeScanned = (decodedText: string) => {
    const currentPurpose = scannerPurpose;
    setScannerPurpose(null);

    if (currentPurpose === 'purchase') {
      const foundPurchase = purchaseList.find(p => (p.id === decodedText || p.invoiceNumber === decodedText) && !p.isReturned);
      if (foundPurchase) {
        handleSelectPurchase(foundPurchase);
      } else {
        setModal({ message: 'No active purchase found with this ID/Invoice.', type: State.ERROR });
      }
    } else if (currentPurpose === 'item') {
      const itemToAdd = availableItems.find(item => item.barcode === decodedText);
      if (itemToAdd) {
        handleItemReceived(itemToAdd);
        setModal({ message: `Added: ${itemToAdd.name}`, type: State.SUCCESS });
      } else {
        setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
      }
    }
  };

  const { totalReturnValue, totalNewItemsValue, finalBalance } = useMemo(() => {
    const totalReturnValue = itemsToReturn.reduce((sum, item) => sum + item.amount, 0);
    const totalNewItemsValue = newItemsReceived.reduce((sum, item) => sum + item.amount, 0);
    return { totalReturnValue, totalNewItemsValue, finalBalance: totalReturnValue - totalNewItemsValue };
  }, [itemsToReturn, newItemsReceived]);

  const saveReturnTransaction = async (completionData?: Partial<PaymentCompletionData>) => {
    if (!currentUser || !selectedPurchase) return;

    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const purchaseRef = doc(db, 'purchases', selectedPurchase.id);

      const originalItemsMap = new Map(selectedPurchase.items.map(item => [item.id, { ...item }]));

      itemsToReturn.forEach(returnItem => {
        const originalItem = originalItemsMap.get(returnItem.originalItemId);
        if (originalItem) {
          originalItem.quantity -= returnItem.quantity;
          if (originalItem.quantity <= 0) {
            originalItemsMap.delete(returnItem.originalItemId);
          }
        }
      });

      newItemsReceived.forEach(newItem => {
        const originalItem = originalItemsMap.get(newItem.originalItemId);
        if (originalItem) {
          originalItem.quantity += newItem.quantity;
        } else {
          originalItemsMap.set(newItem.originalItemId, {
            id: newItem.originalItemId,
            name: newItem.name,
            quantity: newItem.quantity,
            purchasePrice: newItem.unitPrice,
          });
        }
      });

      const newItemsList = Array.from(originalItemsMap.values());
      const newTotalAmount = newItemsList.reduce((sum, item) => sum + (item.quantity * (item.purchasePrice || 0)), 0);

      const returnHistoryRecord = {
        returnedAt: serverTimestamp(),
        returnedItems: itemsToReturn.map(({ id, ...item }) => item),
        newItemsReceived: newItemsReceived.map(({ id, ...item }) => item),
        finalBalance,
        modeOfReturn,
        paymentDetails: completionData?.paymentDetails || null,
      };

      batch.update(purchaseRef, {
        items: newItemsList,
        totalAmount: newTotalAmount,
        returnHistory: arrayUnion(returnHistoryRecord),
      });

      itemsToReturn.forEach(item => {
        batch.update(doc(db, 'items', item.originalItemId), { amount: firebaseIncrement(-item.quantity) });
      });

      newItemsReceived.forEach(item => {
        batch.update(doc(db, 'items', item.originalItemId), { amount: firebaseIncrement(item.quantity) });
      });

      await batch.commit();
      setModal({ type: State.SUCCESS, message: 'Purchase Return processed successfully!' });
      handleClear();
    } catch (error) {
      console.error('Error processing purchase return:', error);
      setModal({ type: State.ERROR, message: 'Failed to process return.' });
    } finally {
      setIsLoading(false);
      setIsDrawerOpen(false);
    }
  };

  const handleProcessReturn = () => {
    if (!currentUser || !selectedPurchase) return;
    if (itemsToReturn.length === 0 && newItemsReceived.length === 0) {
      return setModal({ type: State.ERROR, message: 'No items have been returned or received.' });
    }

    if (modeOfReturn === 'Exchange' && finalBalance < 0) {
      setIsDrawerOpen(true);
    } else {
      saveReturnTransaction();
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-white w-full pb-16">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={scannerPurpose !== null} onClose={() => setScannerPurpose(null)} onScanSuccess={handleBarcodeScanned} />

      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold">&times;</button>
        <div className="flex justify-center gap-x-6">
          <NavLink to={ROUTES.PURCHASE} className="px-2 py-3 text-lg">Purchase</NavLink>
          <NavLink to={ROUTES.PURCHASE_RETURN} className={({ isActive }) => `px-2 py-3 text-lg border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Purchase Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-100 pb-24">
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="relative" ref={dropdownRef}>
            <label htmlFor="search-purchase" className="block text-lg font-medium mb-2">Search Original Purchase</label>
            <div className="flex gap-2">
              <input
                type="text" id="search-purchase" value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder={selectedPurchase ? selectedPurchase.invoiceNumber : "Search by Supplier or Invoice ID"}
                className="flex-grow p-3 border rounded-lg" autoComplete="off" readOnly={!!selectedPurchase}
              />
              {selectedPurchase && (
                <button onClick={handleClear} className="py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg">
                  Clear
                </button>
              )}
            </div>
            {isDropdownOpen && !selectedPurchase && (
              <div className="absolute top-full w-full z-20 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredList.map(item => (
                  <div key={item.id} className="p-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSelectPurchase(item)}>
                    <p className="font-semibold">{item.partyName} ({item.invoiceNumber})</p>
                    <p className="text-sm text-gray-600">Total: ₹{item.totalAmount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedPurchase && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <h3 className="text-xl font-semibold mb-4">Items Being Returned</h3>
              {/* Items to return list would be mapped here */}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div>
                <label htmlFor="mode-of-return" className="block font-medium mb-1">Transaction Type</label>
                <select id="mode-of-return" value={modeOfReturn} onChange={(e) => setModeOfReturn(e.target.value)} className="w-full p-2 border rounded bg-white">
                  <option>Exchange</option>
                  <option>Debit Note</option>
                </select>
              </div>
              {modeOfReturn === 'Exchange' && (
                <div className="pt-6 border-t mt-6">
                  <div className="flex gap-2 items-end">
                    <div className="flex-grow">
                      <SearchableItemInput
                        label="Add New Item Received"
                        placeholder="Search inventory..."
                        items={availableItems}
                        onItemSelected={handleItemReceived}
                        isLoading={isLoading}
                        error={error}
                      />
                    </div>
                    <button onClick={() => setScannerPurpose('item')} className="p-3 bg-gray-700 text-white rounded-lg flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                    </button>
                  </div>
                  {/* New Items Received list would be mapped here */}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="p-4 bg-gray-100 rounded-lg space-y-3">
                <div className="flex justify-between items-center text-md text-red-700"><p>Total Return Value (Debit)</p><p className="font-medium">₹{totalReturnValue.toFixed(2)}</p></div>
                <div className="flex justify-between items-center text-md text-green-700"><p>Total New Items Value (Credit)</p><p className="font-medium">₹{totalNewItemsValue.toFixed(2)}</p></div>
                <div className="border-t border-gray-300 !my-2"></div>
                <div className={`flex justify-between items-center text-2xl font-bold ${finalBalance >= 0 ? 'text-green-600' : 'text-orange-600'}`}><p>{finalBalance >= 0 ? 'Debit Note' : 'Payment Due'}</p><p>₹{Math.abs(finalBalance).toFixed(2)}</p></div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 p-4 bg-white border-t z-30">
        {selectedPurchase && (
          <CustomButton onClick={handleProcessReturn} variant={Variant.Filled} className="w-full py-4 text-xl font-semibold">
            Process Transaction
          </CustomButton>
        )}
      </div>

      <PaymentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        subtotal={Math.abs(finalBalance)}
        onPaymentComplete={saveReturnTransaction}
      />
    </div>
  );
};

export default PurchaseReturnPage;