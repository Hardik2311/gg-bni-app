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
  arrayUnion
} from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import { ROUTES } from '../../constants/routes.constants';
import { Html5Qrcode } from 'html5-qrcode';
import { getItems } from '../../lib/items_firebase';
import type { Item, PurchaseItem as OriginalPurchaseItem } from '../../constants/models';
import { Modal } from '../../constants/Modal';
import { State, Variant } from '../../enums';
import { CustomButton } from '../../Components';
import SearchableItemInput from '../../UseComponents/SearchIteminput';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';

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


const BarcodeScanner: React.FC<{ isOpen: boolean; onClose: () => void; onScanSuccess: (decodedText: string) => void; }> = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  useEffect(() => {
    if (isOpen) {
      const scanner = new Html5Qrcode('barcode-scanner-container');
      scannerRef.current = scanner;
      scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } }, onScanSuccess, undefined)
        .catch(err => console.error("Scanner start error:", err));
    }
    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(err => console.error("Scanner stop error:", err));
      }
    };
  }, [isOpen, onScanSuccess]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
      <div id="barcode-scanner-container" className="w-full max-w-md bg-gray-900 rounded-lg overflow-hidden"></div>
      <button onClick={onClose} className="mt-4 bg-white text-gray-800 font-bold py-2 px-6 rounded-lg shadow-lg hover:bg-gray-200 transition">Close</button>
    </div>
  );
};

const PurchaseReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { purchaseId } = useParams();
  const { state } = useLocation();

  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [supplierName, setSupplierName] = useState<string>('');
  const [supplierNumber, setSupplierNumber] = useState<string>('');
  const [modeOfReturn, setModeOfReturn] = useState<string>('Exchange');


  const [itemsToReturn, setItemsToReturn] = useState<TransactionItem[]>([]);
  const [newItemsReceived, setNewItemsReceived] = useState<TransactionItem[]>([]);

  const [purchaseList, setPurchaseList] = useState<PurchaseData[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseData | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<Item | null>(null);
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const itemDropdownRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [scannerPurpose, setScannerPurpose] = useState<'purchase' | 'item' | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) { setIsLoading(false); return; }
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const purchasesQuery = query(collection(db, 'purchases'));
        const [purchasesSnapshot, allItems] = await Promise.all([getDocs(purchasesQuery), getItems()]);
        const purchases: PurchaseData[] = purchasesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseData));
        setPurchaseList(purchases);
        setAvailableItems(allItems);

        if (state?.invoiceData) {
          handleSelectPurchase(state.invoiceData);
        } else if (purchaseId) {
          const preselectedPurchase = allPurchases.find(p => p.id === purchaseId);
          if (preselectedPurchase) {
            handleSelectPurchase(preselectedPurchase);
          } else {
            setError(`Purchase with ID ${purchaseId} not found.`);
          }
        }
      } catch (err) {
        setError('Failed to load initial data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser, purchaseId, state]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsDropdownOpen(false);
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target as Node)) setIsItemDropdownOpen(false);
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

  const filteredAvailableItems = useMemo(() => availableItems.filter(item =>
    item.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
  ), [availableItems, itemSearchQuery]);

  const handleSelectPurchase = (purchase: PurchaseData) => {
    setSelectedPurchase(purchase);
    setSupplierName(purchase.partyName);
    setSupplierNumber(purchase.partyNumber || '');
    setItemsToReturn(purchase.items.map((item: any) => {
      const unitPrice = item.purchasePrice || 0;
      const quantity = item.quantity || 1;
      return {
        id: crypto.randomUUID(),
        originalItemId: item.id,
        name: item.name,
        quantity: quantity,
        unitPrice: unitPrice,
        amount: unitPrice * quantity,
        mrp: item.mrp || 0,
      };
    }));
    setNewItemsReceived([]);
    setSearchQuery(purchase.invoiceNumber || '');
    setIsDropdownOpen(false);
  };

  const handleClear = () => {
    setSelectedPurchase(null);
    setSupplierName('');
    setSupplierNumber('');
    setItemsToReturn([]);
    setNewItemsReceived([]);
    setSearchQuery('');
  };

  const handleItemChange = (listSetter: React.Dispatch<React.SetStateAction<TransactionItem[]>>, id: string, field: keyof TransactionItem, value: string | number) => {
    listSetter(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity') {
          updatedItem.amount = Number(updatedItem.quantity) * Number(updatedItem.unitPrice);
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const handleRemoveItem = (listSetter: React.Dispatch<React.SetStateAction<TransactionItem[]>>, id: string) => {
    listSetter(prev => prev.filter(item => item.id !== id));
  };

  const handleSelectItemToAdd = (item: Item) => {
    setSelectedItemToAdd(item);
    setItemSearchQuery(item.name);
    setIsItemDropdownOpen(false);
  };

  const handleAddNewItem = () => {
    if (!selectedItemToAdd) return;
    setNewItemsReceived(prev => [...prev, {
      id: crypto.randomUUID(),
      originalItemId: selectedItemToAdd.id!,
      name: selectedItemToAdd.name,
      quantity: 1,
      unitPrice: selectedItemToAdd.purchasePrice || 0,
      amount: selectedItemToAdd.purchasePrice || 0,
    }]);
    setSelectedItemToAdd(null);
    setItemSearchQuery('');
  };

  const handleItemBarcodeScanned = (barcode: string) => {
    setIsItemScannerOpen(false);
    const itemToAdd = availableItems.find(item => item.barcode === barcode);
    if (itemToAdd) {
      setNewItemsReceived(prev => [...prev, {
        id: crypto.randomUUID(),
        originalItemId: itemToAdd.id!,
        name: itemToAdd.name,
        quantity: 1,
        unitPrice: itemToAdd.purchasePrice || 0,
        amount: itemToAdd.purchasePrice || 0,
      }]);
      setModal({ message: `Added: ${itemToAdd.name}`, type: State.SUCCESS });
    } else {
      setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
    }
  };

  const handlePurchaseBarcodeScanned = (scannedId: string) => {
    setIsPurchaseScannerOpen(false);
    const foundPurchase = purchaseList.find(p => p.id === scannedId && !p.isReturned);
    if (foundPurchase) {
      handleSelectPurchase(foundPurchase);
    } else {
      setModal({ message: 'No active purchase found with this ID.', type: State.ERROR });
    }
  };

  const { totalReturnValue, totalNewItemsValue, finalBalance } = useMemo(() => {
    const totalReturnValue = itemsToReturn.reduce((sum, item) => sum + item.amount, 0);
    const totalNewItemsValue = newItemsReceived.reduce((sum, item) => sum + item.amount, 0);
    const originalAmount = selectedPurchase?.totalAmount || 0;
    const newBillAmount = originalAmount - totalReturnValue + totalNewItemsValue;
    const finalBalance = totalReturnValue - totalNewItemsValue;
    return { totalReturnValue, totalNewItemsValue, newBillAmount, finalBalance };
  }, [itemsToReturn, newItemsReceived, selectedPurchase]);

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
        returnedAt: new Date(), // FIXED: Use client-side timestamp
        returnedItems: itemsToReturn.map(({ id, ...item }) => item),
        newItemsReceived: newItemsReceived.map(({ id, ...item }) => item),
        finalBalance,
        modeOfReturn,
        paymentDetails: completionData?.paymentDetails || null,
      };

      const updatedPurchasePayload = {
        items: newItemsList,
        totalAmount: newTotalAmount,
        returnHistory: arrayUnion(returnHistoryRecord),
      };

      batch.update(purchaseRef, updatedPurchasePayload);

      itemsToReturn.forEach(item => {
        if (item.originalItemId) {
          batch.update(doc(db, 'items', item.originalItemId), { amount: firebaseIncrement(-item.quantity) });
        }
      });

      newItemsReceived.forEach(item => {
        if (item.originalItemId) {
          batch.update(doc(db, 'items', item.originalItemId), { amount: firebaseIncrement(item.quantity) });
        }
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

    if (modeOfReturn === 'Exchange') {
      if (finalBalance < 0) {
        setIsDrawerOpen(true);
      } else {
        saveReturnTransaction();
      }
    } else {
      saveReturnTransaction();
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex flex-col min-h-screen bg-white w-full">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isPurchaseScannerOpen} onClose={() => setIsPurchaseScannerOpen(false)} onScanSuccess={handlePurchaseBarcodeScanned} />
      <BarcodeScanner isOpen={isItemScannerOpen} onClose={() => setIsItemScannerOpen(false)} onScanSuccess={handleItemBarcodeScanned} />

      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold">&times;</button>
        <div className="flex justify-center gap-x-6">
          <NavLink to={ROUTES.PURCHASE} className="px-2 py-3 text-lg">Purchase</NavLink>
          <NavLink to={ROUTES.PURCHASE_RETURN} className={({ isActive }) => `px-2 py-3 text-lg border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Purchase Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-100">
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
                <button
                  onClick={handleClear}
                  className="py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
            {isDropdownOpen && (
              <div className="absolute top-full w-full z-20 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredList.map(item => (
                  <div key={item.id} className="p-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSelectPurchase(item)}>
                    <p className="font-semibold">{item.partyName}</p>
                    <p className="text-sm text-gray-600">ID: {item.invoiceNumber?.slice(0, 10)}... | Total: ₹{item.totalAmount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedPurchase ? (
          <>
            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="space-y-4">
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label htmlFor="return-date" className="block font-medium text-sm mb-1">Return Date</label>
                    <input type="date" id="return-date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full p-2 border rounded" />
                  </div>
                  <div>
                    <label htmlFor="supplier-name" className="block font-medium text-sm mb-1">Party Name</label>
                    <input
                      type="text"
                      id="supplier-name"
                      value={supplierName}
                      onChange={(e) => setSupplierName(e.target.value)}
                      className="w-full p-2 border rounded bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="supplier-number" className="block font-medium text-sm mb-1">Party Number</label>
                  <input
                    type="text"
                    id="supplier-number"
                    value={supplierNumber}
                    onChange={(e) => setSupplierNumber(e.target.value)}
                    className="w-full p-2 border rounded bg-white"
                  />
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                <h3 className="text-xl font-semibold mb-4">Items Being Returned (Our Debit)</h3>
                <div className="flex flex-col gap-4">
                  {itemsToReturn.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-2 items-center p-3 border rounded-lg bg-red-50 shadow-sm">
                      <div className="col-span-12 font-medium text-gray-800">{item.name}</div>
                      <input
                        type="number" value={item.quantity}
                        onChange={(e) => handleItemChange(setItemsToReturn, item.id, 'quantity', Number(e.target.value))}
                        className="col-span-3 sm:col-span-3 p-2 border border-gray-300 rounded text-center"
                      />
                      <p className="col-span-4 sm:col-span-4 text-center font-semibold border border-gray-300 p-2 rounded bg-white">₹{item.unitPrice.toFixed(2)}</p>
                      <p className="col-span-4 sm:col-span-4 text-center font-semibold border border-gray-300 p-2 rounded bg-white">₹{item.amount.toFixed(2)}</p>
                      <button
                        onClick={() => handleRemoveItem(setItemsToReturn, item.id)}
                        className="col-span-1 justify-self-center text-red-500 text-2xl hover:text-red-700"
                      >&times;</button>
                    </div>
                  ))}
                </div>
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
                  <>
                    <h3 className="text-xl font-semibold mt-6 mb-4">New Items Received (Our Credit)</h3>
                    <div className="flex flex-col gap-4 mb-6">
                      {newItemsReceived.map((item) => (
                        <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-2 items-center p-3 border rounded-lg bg-green-50 shadow-sm">
                          <div className="col-span-12 font-medium text-gray-800">{item.name}</div>
                          <input
                            type="number" value={item.quantity}
                            onChange={(e) => handleItemChange(setNewItemsReceived, item.id, 'quantity', Number(e.target.value))}
                            className="col-span-3 sm:col-span-3 p-2 border border-gray-300 rounded text-center"
                          />
                          <p className="col-span-4 sm:col-span-4 text-center font-semibold border border-gray-300 p-2 rounded bg-white">₹{item.unitPrice.toFixed(2)}</p>
                          <p className="col-span-4 sm:col-span-4 text-center font-semibold border border-gray-300 p-2 rounded bg-white">₹{item.amount.toFixed(2)}</p>
                          <button
                            onClick={() => handleRemoveItem(setNewItemsReceived, item.id)}
                            className="col-span-1 justify-self-center text-red-500 text-2xl hover:text-red-700"
                          >&times;</button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-6 border-t mt-6">
                      <div className="relative" ref={itemDropdownRef}>
                        <label className="block text-lg font-medium mb-2">Add New Item</label>
                        <div className="flex gap-2">
                          <input
                            type="text" value={itemSearchQuery}
                            onChange={(e) => { setItemSearchQuery(e.target.value); setIsItemDropdownOpen(true); }}
                            onFocus={() => setIsItemDropdownOpen(true)}
                            placeholder="Search inventory..." className="flex-grow p-3 border rounded-lg"
                            autoComplete="off"
                          />
                          <button onClick={handleAddNewItem} className="py-3 px-5 bg-blue-600 text-white rounded-lg font-semibold" disabled={!selectedItemToAdd}>Add</button>
                        </div>
                        {isItemDropdownOpen && (
                          <div className="absolute top-full w-full z-20 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                            {filteredAvailableItems.length > 0 ? filteredAvailableItems.map(item => (
                              <div key={item.id} className="p-3 cursor-pointer hover:bg-gray-100 flex justify-between" onClick={() => handleSelectItemToAdd(item)}>
                                <span>{item.name}</span>
                                <span className="text-gray-500">₹{(item.purchasePrice || 0).toFixed(2)}</span>
                              </div>
                            )) : <div className="p-3 text-gray-500">No matching items found.</div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
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
            ) : (
            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="text-center py-16">
                <p className="text-gray-500">Search for a purchase to begin the return process.</p>
              </div>
            </div>
        )}
          </div>

        <div className="sticky bottom-0 p-4 bg-white border-t">
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