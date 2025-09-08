import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { getItems, getItemByBarcode } from '../../lib/items_firebase';
import type { Item, SalesItem } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment as firebaseIncrement } from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
import { generateNextInvoiceNumber } from '../../UseComponents/InvoiceCounter';
import { Modal } from '../../constants/Modal';
import { State } from '../../enums';

// --- Main Sales Page Component ---
const Sales: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<SalesItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isDiscountLocked, setIsDiscountLocked] = useState(true);
  const [discountInfo, setDiscountInfo] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await getItems();
        setAvailableItems(fetchedItems);
      } catch (err) {
        setError('Failed to load items.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { subtotal, totalDiscount, roundOff, finalAmount } = useMemo(() => {
    const calc = items.reduce((acc, item) => {
      const itemTotal = item.mrp * item.quantity;
      const itemDiscount = item.discount ? (itemTotal * item.discount) / 100 : 0;
      acc.subtotal += itemTotal;
      acc.totalDiscount += itemDiscount;
      return acc;
    }, { subtotal: 0, totalDiscount: 0 });

    const totalBeforeRound = calc.subtotal - calc.totalDiscount;
    const finalAmount = Math.ceil(totalBeforeRound / 10) * 10;
    const roundOff = finalAmount - totalBeforeRound;

    return { ...calc, roundOff, finalAmount };
  }, [items]);


  const addItemToCart = (itemToAdd: Item) => {
    const itemExists = items.find(item => item.id === itemToAdd.id);
    if (itemExists) {
      setItems(prev => prev.map(item => item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setItems(prev => [...prev, { id: itemToAdd.id!, name: itemToAdd.name, mrp: itemToAdd.mrp, quantity: 1, discount: itemToAdd.discount || 0 }]);
    }
  };

  const handleAddItemToCart = () => {
    if (!selectedItem) return;
    const itemToAdd = availableItems.find(item => item.id === selectedItem);
    if (itemToAdd) {
      addItemToCart(itemToAdd);
      setSelectedItem('');
      setSearchQuery('');
    }
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setIsScannerOpen(false);
    const itemToAdd = await getItemByBarcode(barcode);
    if (itemToAdd) {
      addItemToCart(itemToAdd);
      setModal({ message: `Added: ${itemToAdd.name}`, type: State.SUCCESS });
    } else {
      setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
    }
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDiscountPressStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsDiscountLocked(false);
    }, 500);
  };

  const handleDiscountPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleDiscountClick = () => {
    if (isDiscountLocked) {
      setDiscountInfo("Press and hold to edit the discount.");
      setTimeout(() => setDiscountInfo(null), 3000);
    }
  };

  const handleDiscountChange = (id: string, discountValue: number) => {
    const newDiscount = Math.max(0, Math.min(100, discountValue || 0));
    setItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, discount: newDiscount } : item
      )
    );
  };

  const handleProceedToPayment = () => {
    if (items.length === 0) {
      setModal({ message: 'Please add at least one item to the cart.', type: State.INFO });
      return;
    }
    setIsDrawerOpen(true);
  };

  const handleSavePayment = async (completionData: PaymentCompletionData) => {
    if (!currentUser) throw new Error("User is not authenticated.");
    const { paymentDetails, partyName, partyNumber } = completionData;
    const newInvoiceNumber = await generateNextInvoiceNumber();
    const saleData = {
      invoiceNumber: newInvoiceNumber,
      userId: currentUser.uid,
      partyName: partyName.trim(),
      partyNumber: partyNumber.trim(),
      items: items.map(({ id, name, mrp, quantity, discount = 0 }) => {
        const itemTotal = mrp * quantity;
        const itemDiscountAmount = (itemTotal * discount) / 100;
        return { id, name, mrp, quantity, discountPercentage: discount, finalPrice: itemTotal - itemDiscountAmount };
      }),
      subtotal,
      discount: totalDiscount,
      roundOff,
      totalAmount: finalAmount,
      paymentMethods: paymentDetails,
      createdAt: serverTimestamp(),
    };
    const updatePromises = items.map(item => updateDoc(doc(db, "items", item.id), { amount: firebaseIncrement(-item.quantity) }));
    await addDoc(collection(db, "sales"), saleData);
    await Promise.all(updatePromises);
    setIsDrawerOpen(false);
    setItems([]);
    setSelectedItem('');
    setSearchQuery('');
    setModal({ message: `Sale #${newInvoiceNumber} completed!`, type: State.SUCCESS });
  };

  const filteredItems = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];

    return availableItems.filter(item =>
      item.name.toLowerCase().includes(query) ||
      (item.barcode && item.barcode.toLowerCase().includes(query))
    );
  }, [availableItems, searchQuery]);

  const handleSelect = (item: Item) => {
    setSelectedItem(item.id!);
    setSearchQuery(item.name);
    setIsDropdownOpen(false);
  };

  return (
    <div className="flex flex-col min-h-screen bg-white w-full">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600">&times;</button>
        <div className="flex-1 flex justify-center items-center gap-6">
          <NavLink to={ROUTES.SALES} className={({ isActive }: { isActive: boolean }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales</NavLink>
          <NavLink to={ROUTES.SALES_RETURN} className={({ isActive }: { isActive: boolean }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>
      <div className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto box-border">
        <div className="mb-6 relative" ref={dropdownRef}>
          <label className="block text-gray-700 text-sm font-medium mb-1">Search or Scan Barcode</label>
          <div className="flex gap-2">
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} placeholder="Search for an item by name or barcode..." className="flex-grow w-full p-3 border border-gray-300 rounded-md focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200" autoComplete="off" />
            <button onClick={() => setIsScannerOpen(true)} className="bg-gray-700 text-white p-3 rounded-md font-semibold transition hover:bg-gray-800" title="Scan Barcode">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>            </button>
            <button onClick={handleAddItemToCart} className="bg-blue-600 text-white py-3 px-5 rounded-md font-semibold hover:bg-blue-700 disabled:bg-blue-300" disabled={!selectedItem}>Add</button>
          </div>
          {isDropdownOpen && searchQuery && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto">
              {isLoading ? <div className="p-3 text-gray-500">Loading...</div> :
                error ? <div className="p-3 text-red-600">{error}</div> :
                  filteredItems.length === 0 ? <div className="p-3 text-gray-500">No items found.</div> :
                    (filteredItems.map(item => (
                      <div key={item.id} className="p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-100 flex justify-between items-center" onClick={() => handleSelect(item)}>
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="text-sm font-semibold text-blue-600">₹{item.mrp.toFixed(2)}</span>
                      </div>
                    )))
              }
            </div>
          )}
        </div>
        <h3 className="text-gray-700 text-lg font-medium mb-4">Cart</h3>
        {discountInfo && (
          <div className="flex items-center text-sm mb-3 p-3 bg-yellow-100 text-yellow-800 rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
            <span>{discountInfo}</span>
          </div>
        )}
        <div className="flex flex-col gap-3 mb-6">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg">No items added.</div>
          ) : (
            items.map(item => (
              <div key={item.id} className="p-3 bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">₹{item.mrp.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 disabled:opacity-50" onClick={() => handleQuantityChange(item.id, -1)} disabled={item.quantity === 1}>-</button>
                    <span className="w-6 text-center font-semibold">{item.quantity}</span>
                    <button className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200" onClick={() => handleQuantityChange(item.id, 1)}>+</button>
                    <button className="text-gray-500 hover:text-red-500" onClick={() => handleDeleteItem(item.id)} title="Remove item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100" onMouseDown={handleDiscountPressStart} onMouseUp={handleDiscountPressEnd} onMouseLeave={handleDiscountPressEnd} onTouchStart={handleDiscountPressStart} onTouchEnd={handleDiscountPressEnd} onClick={handleDiscountClick}>
                  <label htmlFor={`discount-${item.id}`} className={`text-sm text-gray-600 ${isDiscountLocked ? 'cursor-pointer' : ''}`}>Discount (%):</label>
                  <input id={`discount-${item.id}`} type="number" placeholder="0.00" value={item.discount || ''} onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value))} readOnly={isDiscountLocked} className={`w-20 text-right bg-gray-100 p-1 text-sm rounded-md border-gray-300 focus:ring-blue-500 focus:border-blue-500 ${isDiscountLocked ? 'cursor-not-allowed text-gray-500' : ''}`} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-1">
          <p className="text-md">Subtotal</p>
          <p className="text-md">₹{subtotal.toFixed(2)}</p>
        </div>
        <div className="flex justify-between items-center mb-1 text-red-600">
          <p className="text-md">Discount</p>
          <p className="text-md">- ₹{totalDiscount.toFixed(2)}</p>
        </div>
        <div className="flex justify-between items-center mb-3 border-t pt-3">
          <p className="text-lg font-medium">Total Amount</p>
          <p className="text-2xl font-bold">₹{finalAmount.toFixed(2)}</p>
        </div>
        <button onClick={handleProceedToPayment} className="w-full bg-green-600 text-white p-3 rounded-lg text-lg font-semibold shadow-md hover:bg-green-700 disabled:opacity-50" disabled={items.length === 0}>
          Proceed to Payment
        </button>
      </div>
      <PaymentDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} subtotal={finalAmount} onPaymentComplete={handleSavePayment} />
    </div>
  );
};
export default Sales;
