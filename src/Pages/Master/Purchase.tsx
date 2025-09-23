import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { getItems } from '../../lib/items_firebase';
import type { Item } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment as firebaseIncrement } from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import BarcodeScanner from '../../UseComponents/BarcodeScanner'; // Adjust path
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer'; // Adjust path
import { Modal } from '../../constants/Modal';
import { State } from '../../enums';


// --- Helper Types & Interfaces ---
interface PurchaseItem {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
}

// --- Main Purchase Page Component ---
const PurchasePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await getItems();
        setAvailableItems(fetchedItems);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch items:', err);
        setError('Failed to load items. Please try again later.');
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
  }, [dropdownRef]);

  const addItemToCart = (itemToAdd: Item) => {
    const itemExists = items.find((item) => item.id === itemToAdd.id);
    if (itemExists) {
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      );
    } else {
      setItems((prevItems) => [
        ...prevItems,
        {
          id: itemToAdd.id!,
          name: itemToAdd.name,
          purchasePrice: itemToAdd.purchasePrice || 0,
          quantity: 1,
        },
      ]);
    }
  };

  useEffect(() => {
    if (searchQuery.trim().length > 5) {
      const matchedItem = availableItems.find(item => item.barcode === searchQuery.trim());
      if (matchedItem) {
        addItemToCart(matchedItem);
        setSearchQuery('');
        setIsDropdownOpen(false);
        setModal({ message: `Added: ${matchedItem.name}`, type: State.SUCCESS });
      }
    }
  }, [searchQuery, availableItems]);

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0), [items]);

  const handleQuantityChange = (id: string, delta: number) => { setItems((prevItems) => prevItems.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,),); };
  const handleDeleteItem = (id: string) => { setItems((prevItems) => prevItems.filter((item) => item.id !== id)); };
  const handleAddItemToCart = () => { if (!selectedItem) return; const itemToAdd = availableItems.find((item) => item.id === selectedItem); if (itemToAdd) { addItemToCart(itemToAdd); setSelectedItem(''); setSearchQuery(''); } };

  const handleProceedToPayment = () => {
    if (items.length === 0) {
      setModal({ message: 'Please add at least one item to the cart.', type: State.ERROR });
      return;
    }
    setIsDrawerOpen(true);
  };

  const updateItemStock = async (itemId: string, quantityAdded: number) => {
    const itemRef = doc(db, "items", itemId);
    try {
      await updateDoc(itemRef, { amount: firebaseIncrement(quantityAdded) });
    } catch (error) {
      console.error(`Error updating item stock for ID: ${itemId}`, error);
      throw new Error(`Failed to update inventory for item ID: ${itemId}`);
    }
  };

  const handleSavePurchase = async (completionData: PaymentCompletionData) => {
    if (!currentUser) {
      throw new Error('User is not authenticated.');
    }
    // ✅ Get party details from the completionData object passed from the drawer
    const { paymentDetails, discount, finalAmount, partyName, partyNumber } = completionData;

    const trimmedPartyName = partyName.trim();
    const purchaseData = {
      userId: currentUser.uid,
      partyName: trimmedPartyName,
      partyNumber: partyNumber.trim(),
      discount: discount,
      items: items.map(({ id, name, purchasePrice, quantity }) => ({
        id, name, purchasePrice, quantity,
      })),
      totalAmount: finalAmount,
      paymentMethods: paymentDetails,
      createdAt: serverTimestamp(),
      companyId: currentUser.companyId,
    };

    try {
      await addDoc(collection(db, 'purchases'), purchaseData);

      const updatePromises = items.map(item => updateItemStock(item.id, item.quantity));
      await Promise.all(updatePromises);

      setIsDrawerOpen(false);
      setModal({ message: 'Purchase saved successfully!', type: State.SUCCESS });

      setTimeout(() => {
        setModal(null);
        setItems([]);
        setSelectedItem('');
      }, 1500);

    } catch (err) {
      console.error('Error saving purchase:', err);
      throw err;
    }
  };

  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    const itemToAdd = availableItems.find(item => item.barcode === barcode);
    if (itemToAdd) {
      addItemToCart(itemToAdd);
      setModal({ message: `Added: ${itemToAdd.name}`, type: State.SUCCESS });
    } else {
      setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
    }
  };

  const filteredItems = availableItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600 bg-transparent border-none cursor-pointer p-1">&times;</button>
        <div className="flex-1 flex justify-center items-center gap-6">
          <NavLink to={`${ROUTES.PURCHASE}`} className={({ isActive }) => `flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500'}`}>Purchase</NavLink>
          <NavLink to={`${ROUTES.PURCHASE_RETURN}`} className={({ isActive }) => `flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500'}`}>Purchase Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto box-border">
        {/* The Party Name and Number inputs are no longer needed here */}
        <h3 className="text-gray-700 text-lg font-medium mb-4">Items</h3>
        <div className="flex flex-col gap-3 mb-6">
          {items.length === 0 ? <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg">No items added to the list.</div> : items.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="flex flex-col">
                <p className="text-gray-800 font-medium">{item.name}</p>
                <p className="text-gray-600 text-sm">₹{item.purchasePrice.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-lg font-bold cursor-pointer transition hover:bg-gray-300 disabled:opacity-50" onClick={() => handleQuantityChange(item.id, -1)} disabled={item.quantity === 1}>-</button>
                <span className="text-gray-800 font-semibold w-6 text-center">{item.quantity}</span>
                <button className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 text-lg font-bold cursor-pointer transition hover:bg-gray-300" onClick={() => handleQuantityChange(item.id, 1)}>+</button>
                <button className="text-gray-500 hover:text-red-500 transition-colors" onClick={() => handleDeleteItem(item.id)} title="Remove item"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4 relative" ref={dropdownRef}>
          <label className="block text-gray-700 text-sm font-medium mb-1">Search & Add Item</label>
          <div className="flex gap-2">
            <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setIsDropdownOpen(true); }} onFocus={() => setIsDropdownOpen(true)} placeholder="Search for an item..." className="flex-grow w-full p-3 border border-gray-300 rounded-md text-base focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200" autoComplete="off" />
            <button onClick={() => setIsScannerOpen(true)} className="bg-gray-700 text-white p-3 rounded-md font-semibold transition hover:bg-gray-800" title="Scan Barcode">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
            </button>
            <button onClick={handleAddItemToCart} className="bg-blue-600 text-white py-3 px-5 rounded-md text-base font-semibold transition hover:bg-blue-700 disabled:bg-blue-300" disabled={!selectedItem}>Add</button>
          </div>
          {isDropdownOpen && <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-52 overflow-y-auto">{isLoading ? <div className="p-3 text-gray-500">Loading items...</div> : error ? <div className="p-3 text-red-600">Error loading items.</div> : filteredItems.length === 0 ? <div className="p-3 text-gray-500">No items found.</div> : filteredItems.map((item) => (<div key={item.id} className="p-3 cursor-pointer border-b last:border-b-0 hover:bg-gray-100" onClick={() => handleSelect(item)}>{item.name}</div>))}</div>}
        </div>
      </div>

      <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-3">
          <p className="text-gray-700 text-lg font-medium">Total Amount</p>
          <p className="text-gray-900 text-2xl font-bold">₹{totalAmount.toFixed(2)}</p>
        </div>
        <button onClick={handleProceedToPayment} className="w-full bg-green-600 text-white p-3 rounded-lg text-lg font-semibold shadow-md transition hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={items.length === 0}>Proceed to Payment</button>
      </div>

      <PaymentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        subtotal={totalAmount}
        onPaymentComplete={handleSavePurchase}
      />
    </div>
  );
};

export default PurchasePage;
