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
} from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import { ROUTES } from '../../constants/routes.constants';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import { getItems } from '../../lib/items_firebase';
import type { Item, SalesItem as OriginalSalesItem } from '../../constants/models';
import { Modal } from '../../constants/Modal';
import { State, Variant } from '../../enums';
import { CustomButton } from '../../Components';

// --- Interfaces ---
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


// --- Main Sales Return Page Component ---
const SalesReturnPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { state } = useLocation();
  const { invoiceId } = useParams();

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
  const [scannerPurpose, setScannerPurpose] = useState<'sale' | 'item' | null>(null);

  useEffect(() => {
    if (!currentUser) { setIsLoading(false); return; }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const salesQuery = query(collection(db, 'sales'));
        const [salesSnapshot, allItems] = await Promise.all([getDocs(salesQuery), getItems()]);
        const allSales: SalesData[] = salesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesData));
        setSalesList(allSales);
        setAvailableItems(allItems);

        if (state?.invoiceData) {
          handleSelectSale(state.invoiceData);
        } else if (invoiceId) {
          const preselectedSale = allSales.find(sale => sale.id === invoiceId);
          if (preselectedSale) {
            handleSelectSale(preselectedSale);
          } else {
            setError(`Sale with ID ${invoiceId} not found.`);
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load initial data.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentUser, invoiceId, state]);

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
      (sale.partyName && sale.partyName.toLowerCase().includes(searchSaleQuery.toLowerCase())) ||
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
    setPartyName(sale.partyName || 'N/A'); // Fallback for name
    setPartyNumber(sale.partyNumber || ''); // Fallback for number
    setItemsToReturn(
      sale.items.map((item: any) => {
        const totalLineItemPrice = item.finalPrice || 0;
        const quantity = item.quantity || 1;
        return {
          id: crypto.randomUUID(),
          originalItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: totalLineItemPrice / quantity,
          amount: totalLineItemPrice,
          mrp: item.mrp,
        };
      })
    );
    setExchangeItems([]);
    setSearchSaleQuery(sale.invoiceNumber);
    setIsSalesDropdownOpen(false);
  };

  const handleClear = () => {
    setSelectedSale(null);
    setPartyName('');
    setPartyNumber('');
    setItemsToReturn([]);
    setExchangeItems([]);
    setSearchSaleQuery('');
    navigate(ROUTES.SALES_RETURN); // Navigate to base route to clear params
  };

  const handleItemChange = (listSetter: React.Dispatch<React.SetStateAction<any[]>>, id: string, field: keyof (TransactionItem | ExchangeItem), value: string | number) => {
    listSetter(prev => prev.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
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

  const addExchangeItem = (itemToAdd: Item) => {
    let finalExchangePrice = itemToAdd.mrp * (1 - (itemToAdd.discount || 0) / 100);
    if (finalExchangePrice > 100) {
      finalExchangePrice = Math.ceil(finalExchangePrice / 10) * 10;
    }
    setExchangeItems(prev => [...prev, {
      id: crypto.randomUUID(), originalItemId: itemToAdd.id!, name: itemToAdd.name,
      quantity: 1, unitPrice: finalExchangePrice, amount: finalExchangePrice, mrp: itemToAdd.mrp
    }]);
  };

  const handleAddExchangeItem = () => {
    if (!selectedItemToAdd) return;
    addExchangeItem(selectedItemToAdd);
    setSelectedItemToAdd(null);
    setItemSearchQuery('');
  };

  const handleBarcodeScanned = (barcode: string) => {
    const purpose = scannerPurpose;
    setScannerPurpose(null);

    if (purpose === 'sale') {
      const foundSale = salesList.find(sale => sale.invoiceNumber === barcode);
      if (foundSale) {
        handleSelectSale(foundSale);
        setModal({ message: `Loaded Sale: ${foundSale.invoiceNumber}`, type: State.SUCCESS });
      } else {
        setModal({ message: 'Original sale not found for this invoice.', type: State.ERROR });
      }
    } else if (purpose === 'item') {
      const itemToAdd = availableItems.find(item => item.barcode === barcode);
      if (itemToAdd) {
        addExchangeItem(itemToAdd);
        setModal({ message: `Added for Exchange: ${itemToAdd.name}`, type: State.SUCCESS });
      } else {
        setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
      }
    }
  };

  const { totalReturnValue, totalExchangeValue, roundOff, finalBalance, newBillAmount } = useMemo(() => {
    const totalReturnValue = itemsToReturn.reduce((sum, item) => sum + item.amount, 0);
    const totalExchangeValue = exchangeItems.reduce((sum, item) => sum + item.amount, 0);

    const balanceBeforeRound = totalReturnValue - totalExchangeValue;

    const finalBalance = Math.ceil(balanceBeforeRound / 10) * 10;
    const roundOff = finalBalance - balanceBeforeRound;

    const originalAmount = selectedSale?.totalAmount || 0;
    const newBillAmount = originalAmount - totalReturnValue + totalExchangeValue;

    return { totalReturnValue, totalExchangeValue, roundOff, finalBalance, newBillAmount };
  }, [itemsToReturn, exchangeItems, selectedSale]);

  const handleSaveReturn = async () => {
    if (!currentUser || !selectedSale) {
      setModal({ type: State.ERROR, message: 'An original sale must be selected.' });
      return;
    }
    if (itemsToReturn.length === 0 && exchangeItems.length === 0) {
      setModal({ type: State.ERROR, message: 'No items have been returned or exchanged.' });
      return;
    }

    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', selectedSale.id);

      const originalItemsMap = new Map(selectedSale.items.map(item => [item.id, { ...item }]));

      itemsToReturn.forEach(returnItem => {
        if (originalItemsMap.has(returnItem.originalItemId)) {
          const originalItem = originalItemsMap.get(returnItem.originalItemId)!;
          originalItem.quantity -= returnItem.quantity;
          if (originalItem.quantity <= 0) {
            originalItemsMap.delete(returnItem.originalItemId);
          }
        }
      });

      exchangeItems.forEach(exchangeItem => {
        if (originalItemsMap.has(exchangeItem.originalItemId)) {
          const originalItem = originalItemsMap.get(exchangeItem.originalItemId)!;
          originalItem.quantity += exchangeItem.quantity;
        } else {
          const itemMaster = availableItems.find(i => i.id === exchangeItem.originalItemId);
          originalItemsMap.set(exchangeItem.originalItemId, {
            id: exchangeItem.originalItemId,
            name: exchangeItem.name,
            mrp: exchangeItem.mrp,
            quantity: exchangeItem.quantity,
            discount: itemMaster?.discount || 0,
            discountPercentage: itemMaster?.discount || 0,
            finalPrice: exchangeItem.unitPrice,
          });
        }
      });

      const newItemsList = Array.from(originalItemsMap.values());

      const totals = newItemsList.reduce((acc, item) => {
        const itemSubtotal = item.mrp * item.quantity;
        const itemDiscountAmount = (itemSubtotal * (item.discountPercentage || 0)) / 100;
        acc.subtotal += itemSubtotal;
        acc.totalDiscount += itemDiscountAmount;
        return acc;
      }, { subtotal: 0, totalDiscount: 0 });

      const totalBeforeRound = totals.subtotal - totals.totalDiscount;
      const newFinalAmount = Math.ceil(totalBeforeRound / 10) * 10;
      const newRoundOff = newFinalAmount - totalBeforeRound;

      const returnHistoryRecord = {
        returnedAt: serverTimestamp(),
        returnedItems: itemsToReturn.map(({ id, ...item }) => item),
        exchangeItems: exchangeItems.map(({ id, ...item }) => item),
        balance: finalBalance,
        modeOfReturn,
      };

      const updatedSalePayload = {
        items: newItemsList,
        subtotal: totals.subtotal,
        discount: totals.totalDiscount,
        roundOff: newRoundOff,
        totalAmount: newFinalAmount,
        returnHistory: arrayUnion(returnHistoryRecord)
      };

      batch.update(saleRef, updatedSalePayload);

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
      setModal({ type: State.SUCCESS, message: 'Sale updated successfully!' });
      navigate(ROUTES.SALES);

    } catch (error) {
      console.error('Error processing exchange:', error);
      setModal({ type: State.ERROR, message: 'Failed to update sale. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  if (error) return <div className="flex min-h-screen items-center justify-center text-red-500">{error}</div>;

  return (
    <div className="flex flex-col min-h-screen bg-white w-full">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={scannerPurpose !== null} onClose={() => setScannerPurpose(null)} onScanSuccess={handleBarcodeScanned} />

      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold">&times;</button>
        <div className="flex justify-center gap-x-6">
          <NavLink to={ROUTES.SALES} className={({ isActive }) => `px-2 py-3 text-lg border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales</NavLink>
          <NavLink to={ROUTES.SALES_RETURN} className={({ isActive }) => `px-2 py-3 text-lg border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-100">

        {!selectedSale && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="relative" ref={salesDropdownRef}>
              <label htmlFor="search-sale" className="block text-lg font-medium mb-2">Search Original Sale</label>
              <div className="flex gap-2">
                <input
                  type="text" id="search-sale" value={searchSaleQuery}
                  onChange={(e) => { setSearchSaleQuery(e.target.value); setIsSalesDropdownOpen(true); }}
                  onFocus={() => setIsSalesDropdownOpen(true)}
                  placeholder="Party Name or Invoice ID"
                  className="flex-grow p-3 border rounded-lg" autoComplete="off"
                />
                <button onClick={() => setScannerPurpose('sale')} className="p-3 bg-gray-700 text-white rounded-lg" title="Scan Sale Invoice">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                </button>
              </div>
              {isSalesDropdownOpen && searchSaleQuery && (
                <div className="absolute top-full w-full z-20 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredSales.length > 0 ? filteredSales.map(sale => (
                    <div key={sale.id} className="p-3 cursor-pointer hover:bg-gray-100" onClick={() => handleSelectSale(sale)}>
                      <p className="font-semibold">{sale.partyName} ({sale.invoiceNumber})</p>
                      <p className="font-semibold">{sale.partyNumber} ({sale.invoiceNumber})</p>
                      <p className="text-sm text-gray-600">Total: ₹{sale.totalAmount.toFixed(2)}</p>
                    </div>
                  )) : <div className="p-3 text-gray-500">No matching sales found.</div>}
                </div>
              )}
            </div>
          </div>
        )}

        {selectedSale ? (
          <>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-lg font-semibold text-gray-800">{partyName}</p>
                  <p className="text-lg font-semibold text-gray-800">{partyNumber}</p>
                  <p className="text-sm text-gray-500">{selectedSale.invoiceNumber}</p>
                </div>
                <button onClick={handleClear} className="text-sm font-medium text-red-600 hover:text-red-800">Change Sale</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="return-date" className="block font-medium text-sm mb-1">Return Date</label>
                  <input type="date" id="return-date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full p-2 border rounded" />
                </div>
                <div>
                  <label htmlFor="mode-of-return" className="block font-medium text-sm mb-1">Transaction Type</label>
                  <select id="mode-of-return" value={modeOfReturn} onChange={(e) => setModeOfReturn(e.target.value)} className="w-full p-2 border rounded bg-white">
                    <option>Exchange</option>
                    <option>Credit Note</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <h3 className="text-xl font-semibold mb-4">Items to Return</h3>
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

            {modeOfReturn === 'Exchange' && (
              <div className="bg-white p-6 rounded-lg shadow-md mt-6">
                <div className="relative" ref={itemDropdownRef}>
                  <label className="block text-lg font-medium mb-2">Add Exchange Item</label>
                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <input
                      type="text" value={itemSearchQuery}
                      onChange={(e) => { setItemSearchQuery(e.target.value); setIsItemDropdownOpen(true); }}
                      onFocus={() => setIsItemDropdownOpen(true)}
                      placeholder="Search inventory..."
                      className="w-full sm:w-auto flex-grow p-3 border rounded-lg"
                      autoComplete="off"
                    />
                    <button onClick={() => setScannerPurpose('item')} className="p-3 bg-gray-700 text-white rounded-lg flex-shrink-0" title="Scan Item Barcode">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                    </button>
                    <button onClick={handleAddExchangeItem} className="py-3 px-5 bg-blue-600 text-white rounded-lg font-semibold flex-shrink-0" disabled={!selectedItemToAdd}>Add</button>
                  </div>
                  {isItemDropdownOpen && itemSearchQuery && (
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
                {exchangeItems.length > 0 && (
                  <>
                    <h3 className="text-xl font-semibold mt-6 mb-4">New Exchange Items</h3>
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
            )}

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
                <div className="flex justify-between items-center text-md text-gray-600">
                  <p>Round Off</p>
                  <p className="font-medium">₹{roundOff.toFixed(2)}</p>
                </div>
                <div className="border-t border-gray-300 !my-2"></div>
                <div className={`flex justify-between items-center text-2xl font-bold ${finalBalance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  <p>{finalBalance >= 0 ? 'Refund Due' : 'Amount Owed'}</p>
                  <p>₹{Math.abs(finalBalance).toFixed(2)}</p>
                </div>
              </div>

              <div className="p-4 mt-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between items-center text-gray-700">
                  <p>Original Bill Amount</p>
                  <p className="font-medium">₹{(selectedSale?.totalAmount || 0).toFixed(2)}</p>
                </div>
                <div className="flex justify-between items-center font-semibold text-blue-800">
                  <p>New Bill Amount After Exchange</p>
                  <p>₹{newBillAmount.toFixed(2)}</p>
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