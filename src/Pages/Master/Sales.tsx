import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { getItems } from '../../lib/items_firebase';
import type { Item, SalesItem } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment as firebaseIncrement } from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
// FIX: Import the new invoice number generator
import { generateNextInvoiceNumber } from '../../UseComponents/InvoiceCounter';

// --- Reusable Components (specific to this page) ---
const Modal: React.FC<{ message: string; onClose: () => void; type: 'success' | 'error' | 'info'; }> = ({ message, onClose, type }) => (
  <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
      <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${type === 'success' ? 'bg-green-100' : type === 'error' ? 'bg-red-100' : 'bg-blue-100'}`}>
        {type === 'success' && <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
        {type === 'error' && <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>}
        {type === 'info' && <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
      </div>
      <p className="text-lg font-medium text-gray-800 mb-4">{message}</p>
      <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">OK</button>
    </div>
  </div>
);

// --- Main Sales Page Component ---
const Sales: React.FC = () => {
  // ... all your existing states and hooks ...
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [modal, setModal] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
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

  // ... all your existing useEffect hooks ...
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

  // ... all your other functions (addItemToCart, handleBarcodeScanned, etc.) ...
  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.mrp * item.quantity, 0), [items]);
  const addItemToCart = (itemToAdd: Item) => {
    const itemExists = items.find(item => item.id === itemToAdd.id);
    if (itemExists) {
      setItems(prev => prev.map(item => item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setItems(prev => [...prev, { id: itemToAdd.id!, name: itemToAdd.name, mrp: itemToAdd.mrp, quantity: 1 }]);
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
  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    const itemToAdd = availableItems.find(item => item.barcode === barcode);
    if (itemToAdd) {
      addItemToCart(itemToAdd);
      setModal({ message: `Added: ${itemToAdd.name}`, type: 'success' });
    } else {
      setModal({ message: 'Item not found for this barcode.', type: 'error' });
    }
  };
  const handleQuantityChange = (id: string, delta: number) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };
  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };
  const handleProceedToPayment = () => {
    if (items.length === 0) {
      setModal({ message: 'Please add at least one item to the cart.', type: 'info' });
      return;
    }
    setIsDrawerOpen(true);
  };

  // FIX: This function is updated
  const handleSavePayment = async (completionData: PaymentCompletionData) => {
    if (!currentUser) throw new Error("User is not authenticated.");
    const { paymentDetails, partyName, partyNumber, discount, finalAmount } = completionData;

    // Stock checking logic (remains the same)
    for (const item of items) {
      const availableItem = availableItems.find(i => i.id === item.id);
      if (!availableItem || availableItem.amount < item.quantity) {
        throw new Error(`Not enough stock for item: ${item.name}.`);
      }
    }

    // 1. Generate the new invoice number
    const newInvoiceNumber = await generateNextInvoiceNumber();

    // 2. Add the invoice number to your sale data
    const saleData = {
      invoiceNumber: newInvoiceNumber, // <-- HERE IT IS
      userId: currentUser.uid,
      partyName: partyName.trim(),
      partyNumber: partyNumber.trim(),
      items: items.map(({ id, name, mrp, quantity }) => ({ id, name, mrp, quantity })),
      subtotal: totalAmount,
      discount,
      totalAmount: finalAmount,
      paymentMethods: paymentDetails,
      createdAt: serverTimestamp(),
    };

    // Firestore update logic (remains the same)
    const updatePromises = items.map(item => {
      const itemRef = doc(db, "items", item.id);
      return updateDoc(itemRef, { amount: firebaseIncrement(-item.quantity) });
    });

    await addDoc(collection(db, "sales"), saleData);
    await Promise.all(updatePromises);

    // Reset state (remains the same)
    setIsDrawerOpen(false);
    setItems([]);
    setSelectedItem('');
    setSearchQuery('');
    setModal({ message: `Sale #${newInvoiceNumber} completed!`, type: 'success' });
  };

  const filteredItems = useMemo(() => availableItems.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ), [availableItems, searchQuery]);

  const handleSelect = (item: Item) => {
    setSelectedItem(item.id!);
    setSearchQuery(item.name);
    setIsDropdownOpen(false);
  };

  return (
    // ... your JSX remains exactly the same
    <div className="flex flex-col min-h-screen bg-white w-full">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />

      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600">&times;</button>
        <div className="flex-1 flex justify-center items-center gap-6">
          <NavLink to={ROUTES.SALES} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales</NavLink>
          <NavLink to={ROUTES.SALES_RETURN} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto box-border">
        <div className="mb-6 relative" ref={dropdownRef}>
          <label className="block text-gray-700 text-sm font-medium mb-1">Search & Add Item</label>
          <div className="flex gap-2">
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} placeholder="Search for an item..." className="flex-grow w-full p-3 border border-gray-300 rounded-md focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200" autoComplete="off" />
            <button onClick={() => setIsScannerOpen(true)} className="bg-gray-700 text-white p-3 rounded-md font-semibold transition hover:bg-gray-800" title="Scan Barcode">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
            </button>
            <button onClick={handleAddItemToCart} className="bg-blue-600 text-white py-3 px-5 rounded-md font-semibold hover:bg-blue-700 disabled:bg-blue-300" disabled={!selectedItem}>Add</button>
          </div>
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto">
              {isLoading ? <div className="p-3 text-gray-500">Loading...</div> :
                error ? <div className="p-3 text-red-600">{error}</div> :
                  filteredItems.length === 0 ? <div className="p-3 text-gray-500">No items found.</div> :
                    (filteredItems.map(item => (
                      <div
                        key={item.id}
                        className="p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-100 flex justify-between items-center"
                        onClick={() => handleSelect(item)}
                      >
                        <span className="font-medium text-gray-800">{item.name}</span>
                        <span className="text-sm font-semibold text-blue-600">
                          ₹{item.mrp.toFixed(2)}
                        </span>
                      </div>
                    )))
              }
            </div>
          )}
        </div>

        <h3 className="text-gray-700 text-lg font-medium mb-4">Cart</h3>
        <div className="flex flex-col gap-3 mb-6">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg">No items added.</div>
          ) : (
            items.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-200">
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
            ))
          )}
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-3">
          <p className="text-lg font-medium">Total Amount</p>
          <p className="text-2xl font-bold">₹{totalAmount.toFixed(2)}</p>
        </div>
        <button onClick={handleProceedToPayment} className="w-full bg-green-600 text-white p-3 rounded-lg text-lg font-semibold shadow-md hover:bg-green-700 disabled:opacity-50" disabled={items.length === 0}>
          Proceed to Payment
        </button>
      </div>

      <PaymentDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} subtotal={totalAmount} onPaymentComplete={handleSavePayment} />
    </div>
  );
};

export default Sales;