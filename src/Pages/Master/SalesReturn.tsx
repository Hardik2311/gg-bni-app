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
import type { Item, SalesItem as OriginalSalesItem } from '../../constants/models';
import { Modal } from '../../constants/Modal';
import { State, Variant } from '../../enums';
import { CustomButton } from '../../Components';

interface SalesData {
  id: string;
  invoiceNumber: string;
  partyName: string;
  partyNumber: string;
  items: OriginalSalesItem[];
  totalAmount: number;
  createdAt: any;
  isReturned?: boolean;
}
interface TransactionItem {
  id: string;
  originalItemId: string;
  name: string;
  mrp: number;
  quantity: number;
  unitPrice: number;
  amount: number;
}
interface ExchangeItem {
  id: string;
  originalItemId: string;
  name: string;
  mrp: number;
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


const SalesReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [returnDate, setReturnDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [partyName, setPartyName] = useState<string>('');
  const [partyNumber, setPartyNumber] = useState<string>('');
  const [modeOfReturn, setModeOfReturn] = useState<string>('Exchange');

  const [itemsToReturn, setItemsToReturn] = useState<TransactionItem[]>([]);
  const [exchangeItems, setExchangeItems] = useState<ExchangeItem[]>([]);

  const [salesList, setSalesList] = useState<SalesData[]>([]);
  const [selectedSale, setSelectedSale] = useState<SalesData | null>(null);
  const [searchSaleQuery, setSearchSaleQuery] = useState<string>('');
  const [isSalesDropdownOpen, setIsSalesDropdownOpen] = useState<boolean>(false);
  const salesDropdownRef = useRef<HTMLDivElement>(null);

  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [selectedItemToAdd, setSelectedItemToAdd] = useState<Item | null>(null);
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const itemDropdownRef = useRef<HTMLDivElement>(null);


  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [isSaleScannerOpen, setIsSaleScannerOpen] = useState(false);
  const [isItemScannerOpen, setIsItemScannerOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) { setIsLoading(false); return; }
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const salesQuery = query(collection(db, 'sales'));
        const [salesSnapshot, allItems] = await Promise.all([getDocs(salesQuery), getItems()]);
        const sales: SalesData[] = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesData));
        setSalesList(sales);
        setAvailableItems(allItems);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load initial data.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (salesDropdownRef.current && !salesDropdownRef.current.contains(event.target as Node)) { setIsSalesDropdownOpen(false); }
      if (itemDropdownRef.current && !itemDropdownRef.current.contains(event.target as Node)) { setIsItemDropdownOpen(false); }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredSales = useMemo(() => salesList
    .filter(sale => !sale.isReturned)
    .filter(sale =>
      (sale.partyNumber && sale.partyNumber.toLowerCase().includes(searchSaleQuery.toLowerCase())) ||
      (sale.invoiceNumber && sale.invoiceNumber.toLowerCase().includes(searchSaleQuery.toLowerCase()))
    )
    .sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0)),
    [salesList, searchSaleQuery]
  );

  const filteredAvailableItems = useMemo(() => availableItems.filter(item =>
    item.name.toLowerCase().includes(itemSearchQuery.toLowerCase())
  ), [availableItems, itemSearchQuery]);

  const handleSelectSale = (sale: SalesData) => {
    setSelectedSale(sale);
    setPartyName(sale.partyName);
    setPartyNumber(sale.partyNumber || '');
    setItemsToReturn(
      sale.items.map((item: any) => ({
        id: crypto.randomUUID(),
        originalItemId: item.id,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.finalPrice,
        amount: item.quantity * item.finalPrice,
        mrp: item.mrp,
      }))
    );
    setExchangeItems([]);
    setSearchSaleQuery(sale.invoiceNumber);
    setIsSalesDropdownOpen(false);
  };

  const handleClear = () => {
    setSelectedSale(null);
    setPartyName('');
    setItemsToReturn([]);
    setExchangeItems([]);
    setSearchSaleQuery('');
  };

  const handleItemChange = (listSetter: React.Dispatch<React.SetStateAction<any[]>>, id: string, field: keyof (TransactionItem | ExchangeItem), value: string | number) => {
    listSetter(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity') {
          const quantity = Number(updatedItem.quantity);
          const unitPrice = Number(updatedItem.unitPrice);
          updatedItem.amount = isNaN(quantity) || isNaN(unitPrice) ? 0 : quantity * unitPrice;
        }
        return updatedItem;
      }
      return item;
    }));
  };

  const handleRemoveItem = (listSetter: React.Dispatch<React.SetStateAction<any[]>>, id: string) => {
    listSetter(prev => prev.filter(item => item.id !== id));
  };

  const handleSelectItemToAdd = (item: Item) => {
    setSelectedItemToAdd(item);
    setItemSearchQuery(item.name);
    setIsItemDropdownOpen(false);
  };

  const handleAddExchangeItem = () => {
    if (!selectedItemToAdd) return;
    let finalExchangePrice = selectedItemToAdd.mrp * (1 - (selectedItemToAdd.discount || 0) / 100);
    if (finalExchangePrice > 100) {
      finalExchangePrice = Math.ceil(finalExchangePrice / 10) * 10;
    }
    setExchangeItems(prev => [...prev, {
      id: crypto.randomUUID(), originalItemId: selectedItemToAdd.id!, name: selectedItemToAdd.name,
      quantity: 1, unitPrice: finalExchangePrice, amount: finalExchangePrice, mrp: selectedItemToAdd.mrp
    }]);
    setSelectedItemToAdd(null);
    setItemSearchQuery('');
  };

  const handleItemBarcodeScanned = (barcode: string) => {
    setIsItemScannerOpen(false);
    const itemToAdd = availableItems.find(item => item.barcode === barcode);
    if (itemToAdd) {
      let finalExchangePrice = itemToAdd.mrp * (1 - (itemToAdd.discount || 0) / 100);
      if (finalExchangePrice > 100) {
        finalExchangePrice = Math.ceil(finalExchangePrice / 10) * 10;
      }
      setExchangeItems(prev => [...prev, {
        id: crypto.randomUUID(), originalItemId: itemToAdd.id!, name: itemToAdd.name,
        quantity: 1, unitPrice: finalExchangePrice, amount: finalExchangePrice, mrp: itemToAdd.mrp
      }]);
      setModal({ message: `Added for Exchange: ${itemToAdd.name}`, type: State.SUCCESS });
    } else {
      setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
    }
  };


  const totalReturnValue = useMemo(() => itemsToReturn.reduce((sum, item) => sum + item.amount, 0), [itemsToReturn]);
  const totalExchangeValue = useMemo(() => exchangeItems.reduce((sum, item) => sum + item.amount, 0), [exchangeItems]);
  const finalBalance = useMemo(() => totalReturnValue - totalExchangeValue, [totalReturnValue, totalExchangeValue]);

  const handleSaveReturn = async () => {
    if (!currentUser || !selectedSale) { return setModal({ type: State.ERROR, message: 'An original sale must be selected.' }); }
    if (itemsToReturn.length === 0 && exchangeItems.length === 0) { return setModal({ type: State.ERROR, message: 'No items have been returned or exchanged.' }); }

    try {
      const returnDetailsPayload = {
        isReturned: true,
        returnDetails: {
          returnDate,
          returnedItems: itemsToReturn.map(({ id, ...item }) => item),
          exchangeItems: exchangeItems.map(({ id, ...item }) => item),
          totalReturnValue,
          totalExchangeValue,
          finalBalance,
          modeOfReturn,
          returnedAt: serverTimestamp(),
        }
      };
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', selectedSale.id);
      batch.update(saleRef, returnDetailsPayload);
      itemsToReturn.forEach(item => {
        if (item.originalItemId) {
          const itemRef = doc(db, 'items', item.originalItemId);
          batch.update(itemRef, { amount: firebaseIncrement(item.quantity) });
        }
      });
      exchangeItems.forEach(item => {
        if (item.originalItemId) {
          const itemRef = doc(db, 'items', item.originalItemId);
          batch.update(itemRef, { amount: firebaseIncrement(-item.quantity) });
        }
      });
      await batch.commit();
      setModal({ type: State.SUCCESS, message: 'Exchange processed successfully!' });
      handleClear();
    } catch (error) {
      console.error('Error processing exchange:', error);
      setModal({ type: State.ERROR, message: 'Failed to process exchange. Please try again.' });
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="flex min-h-screen items-center justify-center text-red-500">{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-white w-full">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner
        isOpen={isSaleScannerOpen}
        onClose={() => setIsSaleScannerOpen(false)}
        onScanSuccess={handleItemBarcodeScanned}
      />
      <BarcodeScanner isOpen={isItemScannerOpen} onClose={() => setIsItemScannerOpen(false)} onScanSuccess={handleItemBarcodeScanned} />
      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold">&times;</button>
        <div className="flex-1 flex justify-center gap-6">
          <NavLink to={ROUTES.SALES} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales</NavLink>
          <NavLink to={ROUTES.SALES_RETURN} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-100">

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="relative" ref={salesDropdownRef}>
            <label htmlFor="search-sale" className="block text-lg font-medium mb-2">Search Original Sale</label>
            <div className="flex gap-2">
              <input
                type="text" id="search-sale" value={searchSaleQuery}
                onChange={(e) => { setSearchSaleQuery(e.target.value); setIsSalesDropdownOpen(true); }}
                onFocus={() => setIsSalesDropdownOpen(true)}
                placeholder="Search by Party Number or Invoice ID"
                className="flex-grow p-3 border rounded-lg" autoComplete="off"
              />
            </div>
            {isSalesDropdownOpen && (
              <div className="absolute top-full w-full z-20 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredSales.length > 0 ? filteredSales.map(sale => (
                  <div key={sale.id} className="p-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSelectSale(sale)}>
                    <p className="font-semibold">{sale.partyName} ({sale.partyNumber})</p>
                    <p className="text-sm text-gray-600">ID: {sale.invoiceNumber.slice(0, 10)}... | Total: ₹{sale.totalAmount.toFixed(2)}</p>
                  </div>
                )) : <div className="p-3 text-gray-500">No matching sales found.</div>}
              </div>
            )}
            {selectedSale && <button onClick={handleClear} className="mt-2 w-full py-2 bg-red-500 text-white rounded-lg">Clear Selection</button>}
          </div>
        </div>

        {selectedSale ? (
          <>

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="return-date" className="block font-medium mb-1">Date</label>
                  <input type="date" id="return-date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label htmlFor="party-name" className="block font-medium mb-1">Party Name</label>
                  <input type="text" id="party-name" value={partyName} className="w-full p-2 border rounded bg-gray-100" readOnly />
                  <label htmlFor="party-number" className="block font-medium mt-2">Party Number</label>
                  <input type="text" id="party-number" value={partyNumber} className="w-full p-2 border rounded bg-gray-100" readOnly />
                </div>
              </div>
              <h3 className="text-xl font-semibold mb-4">Transaction Items</h3>
              <div className="flex flex-col gap-4">
                {itemsToReturn.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-2 items-center p-3 border rounded-lg bg-red-50 shadow-sm">
                    <div className="col-span-12 font-medium text-gray-800">{item.name}</div>
                    <input
                      type="number" value={item.quantity}
                      onChange={(e) => handleItemChange(setItemsToReturn, item.id, 'quantity', Number(e.target.value))}
                      className="col-span-3 sm:col-span-3 p-2 border border-gray-300 rounded text-center"
                    />
                    <p className="col-span-4 sm:col-span-4 text-center text-gray-500 line-through border border-gray-300 p-2 rounded bg-white">₹{item.mrp.toFixed(2)}</p>
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
              <div className="flex flex-col gap-4">
                <div>
                  <label htmlFor="mode-of-return" className="block font-medium mb-1">Transaction Type</label>
                  <select id="mode-of-return" value={modeOfReturn} onChange={(e) => setModeOfReturn(e.target.value)} className="w-full p-2 border rounded bg-white">
                    <option>Exchange</option>
                    <option>Credit Note</option>
                  </select>
                </div>
              </div>
              {modeOfReturn === 'Exchange' && (
                <>
                  <div className="pt-6 border-t mt-6">
                    <div className="relative" ref={itemDropdownRef}>
                      <label className="block text-lg font-medium mb-2">Add Exchange Item</label>
                      <div className="flex gap-2">
                        <input
                          type="text" value={itemSearchQuery}
                          onChange={(e) => { setItemSearchQuery(e.target.value); setIsItemDropdownOpen(true); }}
                          onFocus={() => setIsItemDropdownOpen(true)}
                          placeholder="Search inventory..." className="flex-grow p-3 border rounded-lg"
                          autoComplete="off"
                        />
                        <button onClick={() => setIsItemScannerOpen(true)} className="p-3 bg-gray-700 text-white rounded-lg" title="Scan Item Barcode">
                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                        </button>
                        <button onClick={handleAddExchangeItem} className="py-3 px-5 bg-blue-600 text-white rounded-lg font-semibold" disabled={!selectedItemToAdd}>Add</button>
                      </div>
                      {isItemDropdownOpen && (
                        <div className="absolute top-full w-full z-20 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredAvailableItems.length > 0 ? filteredAvailableItems.map(item => (
                            <div key={item.id} className="p-3 cursor-pointer hover:bg-gray-100 flex justify-between" onClick={() => handleSelectItemToAdd(item)}>
                              <span>{item.name}</span>
                              <span className="text-gray-500">₹{(item.mrp).toFixed(2)}</span>
                            </div>
                          )) : <div className="p-3 text-gray-500">No items found.</div>}
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold mt-6 mb-4"> Exchange Items </h3>
                  <div className="flex flex-col gap-4 mb-6">
                    {exchangeItems.map((item) => (
                      <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-2 items-center p-3 border rounded-lg bg-green-50 shadow-sm">
                        <div className="col-span-12 font-medium text-gray-800">{item.name}</div>
                        <input
                          type="number" value={item.quantity}
                          onChange={(e) => handleItemChange(setExchangeItems, item.id, 'quantity', Number(e.target.value))}
                          className="col-span-3 sm:col-span-3 p-2 border border-gray-300 rounded text-center"
                        />
                        <div className="col-span-4 sm:col-span-4 flex items-center justify-center gap-x-2 border border-gray-300 p-2 rounded bg-white">
                          <span className="text-gray-500 line-through">₹{item.mrp.toFixed(2)}</span>

                        </div>
                        <p className="col-span-4 sm:col-span-4 text-center font-semibold border border-gray-300 p-2 rounded bg-white">₹{item.amount.toFixed(2)}</p>
                        <button
                          onClick={() => handleRemoveItem(setExchangeItems, item.id)}
                          className="col-span-1 justify-self-center text-red-500 text-2xl hover:text-red-700"
                        >&times;</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="p-4 bg-gray-100 rounded-lg space-y-3">
                <div className="flex justify-between items-center text-md text-green-700">
                  <p>Total Return Value (Credit)</p>
                  <p className="font-medium">₹{totalReturnValue.toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center text-md text-red-700">
                  <p>Total Exchange Value (Debit)</p>
                  <p className="font-medium">- ₹{totalExchangeValue.toFixed(2)}</p>
                </div>
                <div className="border-t border-gray-300 !my-2"></div>
                <div className={`flex justify-between items-center text-2xl font-bold ${finalBalance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  <p>{finalBalance >= 0 ? 'Refund Due' : 'Amount Owed'}</p>
                  <p>₹{Math.abs(finalBalance).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-md mt-6">
            <div className="text-center py-16">
              <p className="text-gray-500">Search for a sale to begin the return process.</p>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 p-4 bg-white border-t">
        {selectedSale && (
          <CustomButton onClick={handleSaveReturn} variant={Variant.Filled} className="w-full py-4 text-xl font-semibold">
            Process Transaction
          </CustomButton>
        )}
      </div>
    </div>
  );
};

export default SalesReturnPage;