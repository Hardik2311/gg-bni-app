import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  getDocs,
  serverTimestamp,
  doc,
  writeBatch,
  increment as firebaseIncrement,
} from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import { ROUTES } from '../../constants/routes.constants';
import { Html5Qrcode } from 'html5-qrcode';
import { getItems } from '../../lib/items_firebase';
import type { Item, PurchaseItem as OriginalPurchaseItem } from '../../constants/models';
import { Modal } from '../../constants/Modal';
import { State, Variant } from '../../enums';
import { CustomButton } from '../../Components';

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
  const [isPurchaseScannerOpen, setIsPurchaseScannerOpen] = useState(false);
  const [isItemScannerOpen, setIsItemScannerOpen] = useState(false);


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
      } catch (err) {
        setError('Failed to load initial data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

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
    setItemsToReturn(purchase.items.map(i => ({
      id: crypto.randomUUID(),
      originalItemId: i.id,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.purchasePrice,
      amount: i.quantity * i.purchasePrice,
    })));
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

  const totalReturnValue = useMemo(() => itemsToReturn.reduce((sum, item) => sum + item.amount, 0), [itemsToReturn]);
  const totalNewItemsValue = useMemo(() => newItemsReceived.reduce((sum, item) => sum + item.amount, 0), [newItemsReceived]);
  const finalBalance = useMemo(() => totalReturnValue - totalNewItemsValue, [totalReturnValue, totalNewItemsValue]);

  const handleProcessReturn = async () => {
    if (!currentUser || !selectedPurchase) return;
    if (itemsToReturn.length === 0 && newItemsReceived.length === 0) {
      return setModal({ type: State.ERROR, message: 'No items have been returned or received.' });
    }

    try {
      const returnDetailsPayload = {
        isReturned: true,
        returnDetails: {
          returnDate,
          returnedItems: itemsToReturn.map(({ id, ...item }) => item),
          newItemsReceived: newItemsReceived.map(({ id, ...item }) => item),
          totalReturnValue,
          totalNewItemsValue,
          finalBalance,
          modeOfReturn,
          returnedAt: serverTimestamp(),
        }
      };

      const batch = writeBatch(db);
      const purchaseRef = doc(db, 'purchases', selectedPurchase.id);
      batch.update(purchaseRef, returnDetailsPayload);

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
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="flex min-h-screen items-center justify-center text-red-500">{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-white w-full">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isPurchaseScannerOpen} onClose={() => setIsPurchaseScannerOpen(false)} onScanSuccess={handlePurchaseBarcodeScanned} />
      <BarcodeScanner isOpen={isItemScannerOpen} onClose={() => setIsItemScannerOpen(false)} onScanSuccess={handleItemBarcodeScanned} />

      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold">&times;</button>
        <div className="flex-1 flex justify-center gap-6">
          <NavLink to={ROUTES.PURCHASE} className={({ isActive }) => `flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500'}`}>Purchase</NavLink>
          <NavLink to={ROUTES.PURCHASE_RETURN} className={({ isActive }) => `flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500'}`}>Purchase Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-100">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="relative" ref={dropdownRef}>
            <label htmlFor="search-purchase" className="block text-lg font-medium mb-2">Search Original Purchase</label>
            <div className="flex gap-2">
              <input
                type="text" id="search-purchase" value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Search by Supplier or Invoice ID"
                className="flex-grow p-3 border rounded-lg" autoComplete="off"
              />
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
            {selectedPurchase && <button onClick={handleClear} className="mt-2 w-full py-2 bg-red-500 text-white rounded-lg">Clear Selection</button>}
          </div>
        </div>

        {selectedPurchase ? (
          <>
            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="return-date" className="block font-medium mb-1">Date</label>
                  <input type="date" id="return-date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label htmlFor="supplier-name" className="block font-medium mb-1">Supplier Name</label>
                  <input type="text" id="supplier-name" value={supplierName} className="w-full p-2 border rounded bg-gray-100" readOnly />
                  <input type="text" id="supplier-name" value={supplierNumber} className="w-full p-2 border rounded bg-gray-100" readOnly />
                </div>
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
                <div className="flex justify-between items-center text-md text-red-700">
                  <p>Total Return Value (Debit)</p>
                  <p className="font-medium">₹{totalReturnValue.toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center text-md text-green-700">
                  <p>Total New Items Value (Credit)</p>
                  <p className="font-medium">- ₹{totalNewItemsValue.toFixed(2)}</p>
                </div>
                <div className="border-t border-gray-300 !my-2"></div>
                <div className={`flex justify-between items-center text-2xl font-bold ${finalBalance <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  <p>{finalBalance <= 0 ? 'Credit Due' : 'Amount Payable'}</p>
                  <p>₹{Math.abs(finalBalance).toFixed(2)}</p>
                </div>
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
    </div>
  );
};

export default PurchaseReturnPage;