import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, NavLink, useParams, useLocation } from 'react-router-dom';
import { db } from '../../lib/firebase';
import {
  collection,
  query,
  getDocs,
  doc,
  writeBatch,
  increment as firebaseIncrement,
  arrayUnion,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useAuth, useDatabase } from '../../context/auth-context';
import { ROUTES } from '../../constants/routes.constants';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import type { Item, SalesItem as OriginalSalesItem } from '../../constants/models';
import { Modal } from '../../constants/Modal';
import { State, Variant } from '../../enums';
import { CustomButton } from '../../Components';
import SearchableItemInput from '../../UseComponents/SearchIteminput';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';

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
  const dbOperations = useDatabase();
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
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [scannerPurpose, setScannerPurpose] = useState<'sale' | 'item' | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!currentUser || !currentUser.companyId || !dbOperations) {
      setIsLoading(false);
      return;
    }
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const salesQuery = query(
          collection(db, 'sales'),
          where('companyId', '==', currentUser.companyId)
        );

        const [salesSnapshot, allItems] = await Promise.all([
          getDocs(salesQuery),
          dbOperations.getItems(),
        ]);

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
        setError('Failed to load initial data. Check Firestore rules and network.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [currentUser, dbOperations, invoiceId, state]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (salesDropdownRef.current && !salesDropdownRef.current.contains(event.target as Node)) {
        setIsSalesDropdownOpen(false);
      }
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

  const handleSelectSale = (sale: SalesData) => {
    setSelectedSale(sale);
    setPartyName(sale.partyName || 'N/A');
    setPartyNumber(sale.partyNumber || '');
    setItemsToReturn(
      sale.items.map((item: any) => {
        const unitPrice = item.finalPrice / (item.quantity || 1);
        return {
          id: crypto.randomUUID(),
          originalItemId: item.id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: unitPrice,
          amount: item.finalPrice || 0,
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
    navigate(ROUTES.SALES_RETURN);
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

  const addExchangeItem = (itemToAdd: Item) => {
    const finalExchangePrice = itemToAdd.mrp * (1 - (itemToAdd.discount || 0) / 100);
    setExchangeItems(prev => [...prev, {
      id: crypto.randomUUID(), originalItemId: itemToAdd.id!, name: itemToAdd.name,
      quantity: 1, unitPrice: finalExchangePrice, amount: finalExchangePrice, mrp: itemToAdd.mrp
    }]);
  };

  const handleExchangeItemSelected = (item: Item) => {
    if (item) addExchangeItem(item);
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

  const { totalReturnValue, totalExchangeValue, finalBalance } = useMemo(() => {
    const totalReturnValue = itemsToReturn.reduce((sum, item) => sum + item.amount, 0);
    const totalExchangeValue = exchangeItems.reduce((sum, item) => sum + item.amount, 0);
    const balanceBeforeRound = totalReturnValue - totalExchangeValue;

    let roundedAmount;
    if (balanceBeforeRound < 100) {
      roundedAmount = Math.ceil(balanceBeforeRound / 5) * 5;
    } else {
      roundedAmount = Math.ceil(balanceBeforeRound / 10) * 10;
    }

    const finalBalance = roundedAmount;
    const roundOff = finalBalance - balanceBeforeRound;

    return { totalReturnValue, totalExchangeValue, finalBalance, roundOff };
  }, [itemsToReturn, exchangeItems]);

  const saveReturnTransaction = async (completionData?: Partial<PaymentCompletionData>) => {
    if (!currentUser || !selectedSale) return;

    setIsLoading(true);
    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', selectedSale.id);
      const originalItemsMap = new Map(selectedSale.items.map(item => [item.id, { ...item }]));

      itemsToReturn.forEach(returnItem => {
        const originalItem = originalItemsMap.get(returnItem.originalItemId);
        if (originalItem) {
          originalItem.quantity -= returnItem.quantity;
          if (originalItem.quantity <= 0) {
            originalItemsMap.delete(returnItem.originalItemId);
          }
        }
      });

      exchangeItems.forEach(exchangeItem => {
        const originalItem = originalItemsMap.get(exchangeItem.originalItemId);
        if (originalItem) {
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
            finalPrice: exchangeItem.amount,
          });
        }
      });

      const newItemsList = Array.from(originalItemsMap.values());

      const updatedTotals = newItemsList.reduce((acc, item) => {
        const itemTotal = item.mrp * item.quantity;
        const itemDiscount = (itemTotal * (item.discountPercentage || 0)) / 100;
        acc.subtotal += itemTotal;
        acc.totalDiscount += itemDiscount;
        return acc;
      }, { subtotal: 0, totalDiscount: 0 });

      const updatedFinalAmount = updatedTotals.subtotal - updatedTotals.totalDiscount;

      const returnHistoryRecord = {
        returnedAt: new Date(),
        returnedItems: itemsToReturn.map(({ id, ...item }) => item),
        exchangeItems: exchangeItems.map(({ id, ...item }) => item),
        finalBalance: finalBalance,
        modeOfReturn,
        paymentDetails: completionData?.paymentDetails || null,
      };

      batch.set(saleRef, {
        items: newItemsList,
        subtotal: updatedTotals.subtotal,
        discount: updatedTotals.totalDiscount,
        totalAmount: updatedFinalAmount,
        returnHistory: arrayUnion(returnHistoryRecord),
      }, { merge: true });

      itemsToReturn.forEach(item => {
        batch.update(doc(db, 'items', item.originalItemId), { amount: firebaseIncrement(item.quantity) });
      });

      exchangeItems.forEach(item => {
        batch.update(doc(db, 'items', item.originalItemId), { amount: firebaseIncrement(-item.quantity) });
      });

      if (finalBalance > 0 && partyNumber && partyNumber.length >= 10) {
        const customerRef = doc(db, 'customers', partyNumber);
        batch.set(customerRef, {
          creditBalance: firebaseIncrement(finalBalance),
          name: partyName,
          number: partyNumber,
          companyId: currentUser.companyId,
          lastUpdatedAt: serverTimestamp()
        }, { merge: true });
      }

      await batch.commit();
      setModal({ type: State.SUCCESS, message: 'Sale Return processed successfully!' });
      navigate(ROUTES.SALES);
    } catch (err) {
      console.error("Detailed error during sales return:", err);
      setModal({ type: State.ERROR, message: "Failed to process the return. Check permissions and data." });
    } finally {
      setIsLoading(false);
      setIsDrawerOpen(false);
    }
  };

  const handleProcessReturn = () => {
    if (!currentUser || !selectedSale) return;
    if (itemsToReturn.length === 0 && exchangeItems.length === 0) {
      return setModal({ type: State.ERROR, message: 'No items have been returned or exchanged.' });
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
    <div className="flex flex-col min-h-screen bg-white w-full pb-16">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={scannerPurpose !== null} onClose={() => setScannerPurpose(null)} onScanSuccess={handleBarcodeScanned} />

      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold">&times;</button>
        <div className="flex justify-center gap-x-6">
          <NavLink to={ROUTES.SALES} className="px-2 py-3 text-lg">Sales</NavLink>
          <NavLink to={ROUTES.SALES_RETURN} className={({ isActive }) => `px-2 py-3 text-lg border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-100 pb-24">
        <div className="bg-white p-6 rounded-lg shadow-md mb-6">
          <div className="relative" ref={salesDropdownRef}>
            <label htmlFor="search-sale" className="block text-lg font-medium mb-2">
              Search Original Sale
            </label>
            <div className="flex gap-2">
              <input
                id="search-sale"
                type="text"
                value={searchSaleQuery}
                onChange={(e) => {
                  setSearchSaleQuery(e.target.value);
                  setIsSalesDropdownOpen(true);
                }}
                onFocus={() => setIsSalesDropdownOpen(true)}
                placeholder={selectedSale ? selectedSale.invoiceNumber : "Search by invoice or party name..."}
                className="flex-grow p-3 border rounded-lg"
                autoComplete="off"
                readOnly={!!selectedSale}
              />
              {selectedSale && (
                <button
                  onClick={handleClear}
                  className="py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
            {isSalesDropdownOpen && searchSaleQuery && !selectedSale && (
              <div className="absolute top-full w-full z-20 mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-y-auto">
                {filteredSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-3 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSelectSale(sale)}
                  >
                    <p className="font-semibold">{sale.partyName} ({sale.invoiceNumber})</p>
                    <p className="text-sm text-gray-600">Total: ₹{sale.totalAmount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedSale && (
          <>
            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="return-date" className="block font-medium text-sm mb-1">Return Date</label>
                    <input
                      type="date"
                      id="return-date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label htmlFor="party-name" className="block font-medium text-sm mb-1">Party Name</label>
                    <input
                      type="text"
                      id="party-name"
                      value={partyName}
                      onChange={(e) => setPartyName(e.target.value)}
                      className="w-full p-2 border rounded bg-white"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="party-number" className="block font-medium text-sm mb-1">Party Number</label>
                  <input
                    type="text"
                    id="party-number"
                    value={partyNumber}
                    onChange={(e) => setPartyNumber(e.target.value)}
                    className="w-full p-2 border rounded bg-white"
                  />
                </div>
              </div>

              <h3 className="text-xl font-semibold mt-6 mb-4">Items to Return</h3>
              <div className="flex flex-col gap-4">
                {itemsToReturn.map((item) => (
                  <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-2 items-center p-3 border rounded-lg bg-red-50 shadow-sm">
                    <div className="col-span-12 font-medium text-gray-800">{item.name}</div>
                    <input type="number" value={item.quantity} onChange={(e) => handleItemChange(setItemsToReturn, item.id, 'quantity', Number(e.target.value))} className="col-span-3 p-2 border border-gray-300 rounded text-center" />
                    <p className="col-span-4 text-center text-gray-500 line-through border border-gray-300 p-2 rounded bg-white">₹{item.mrp.toFixed(2)}</p>
                    <p className="col-span-4 text-center font-semibold border border-gray-300 p-2 rounded bg-white">₹{item.unitPrice.toFixed(2)}</p>
                    <button onClick={() => handleRemoveItem(setItemsToReturn, item.id)} className="col-span-1 justify-self-center text-red-500 text-2xl hover:text-red-700">&times;</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div>
                <label htmlFor="mode-of-return" className="block font-medium text-sm mb-1">Transaction Type</label>
                <select id="mode-of-return" value={modeOfReturn} onChange={(e) => setModeOfReturn(e.target.value)} className="w-full p-2 border rounded bg-white">
                  <option>Exchange</option>
                  <option>Credit Note</option>
                </select>
              </div>

              {modeOfReturn === 'Exchange' && (
                <div className="mt-6 border-t pt-6">
                  <div className="flex items-end gap-4">
                    <div className="flex-grow">
                      <SearchableItemInput
                        label="Add Exchange Item"
                        placeholder="Search inventory..."
                        items={availableItems}
                        onItemSelected={handleExchangeItemSelected}
                        isLoading={isLoading}
                        error={error}
                      />
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => setScannerPurpose('item')}
                        className="p-3 bg-gray-700 text-white rounded-lg flex items-center justify-center"
                        title="Scan Item Barcode"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                      </button>
                    </div>
                  </div>

                  {exchangeItems.length > 0 && (
                    <>
                      <h3 className="text-xl font-semibold mt-6 mb-4">Exchange Items</h3>
                      <div className="flex flex-col gap-4 mb-6">
                        {exchangeItems.map((item) => (
                          <div key={item.id} className="grid grid-cols-12 gap-x-2 gap-y-2 items-center p-3 border rounded-lg bg-green-50 shadow-sm">
                            <div className="col-span-12 font-medium text-gray-800">{item.name}</div>
                            <input type="number" value={item.quantity} onChange={(e) => handleItemChange(setExchangeItems, item.id, 'quantity', Number(e.target.value))} className="col-span-3 p-2 border border-gray-300 rounded text-center" />
                            <p className="col-span-4 text-center text-gray-500 line-through border border-gray-300 p-2 rounded bg-white">
                              ₹{item.mrp.toFixed(2)}
                            </p>
                            <p className="col-span-4 text-center font-semibold border border-gray-300 p-2 rounded bg-white">
                              ₹{item.unitPrice.toFixed(2)}
                            </p>
                            <button onClick={() => handleRemoveItem(setExchangeItems, item.id)} className="col-span-1 justify-self-center text-red-500 text-2xl hover:text-red-700">&times;</button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-lg shadow-md mt-6">
              <div className="p-4 bg-gray-100 rounded-lg space-y-3">
                <div className="flex justify-between items-center text-md text-blue-700"><p>Return Sale Amount</p><p className="font-medium">₹{totalReturnValue.toFixed(2)}</p></div>
                <div className="flex justify-between items-center text-md text-blue-700"><p>Total Exchange Value</p><p className="font-medium">₹{totalExchangeValue.toFixed(2)}</p></div>
                <div className="border-t border-gray-300 !my-2"></div>
                <div className={`flex justify-between items-center text-2xl font-bold ${finalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}><p>{finalBalance >= 0 ? 'Credit Due' : 'Payment Due'}</p><p>₹{Math.abs(finalBalance).toFixed(2)}</p></div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 p-4 bg-white border-t z-30">
        {selectedSale && (<CustomButton onClick={handleProcessReturn} variant={Variant.Filled} className="w-full py-4 text-xl font-semibold">Process Transaction</CustomButton>)}
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

export default SalesReturnPage;