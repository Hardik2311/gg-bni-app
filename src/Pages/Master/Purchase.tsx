import React, { useState, useEffect } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import type { Item } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment as firebaseIncrement } from 'firebase/firestore';
import { useAuth, useDatabase } from '../../context/auth-context';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
import { Modal } from '../../constants/Modal';
import { State } from '../../enums';
import SearchableItemInput from '../../UseComponents/SearchIteminput';

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
  const dbOperations = useDatabase();
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (!dbOperations) {
      setIsLoading(false);
      return;
    }

    const fetchItems = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await dbOperations.getItems();
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
  }, [dbOperations]);

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

  const totalAmount = React.useMemo(() => items.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0), [items]);

  const handleQuantityChange = (id: string, delta: number) => {
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const handleItemSelected = (item: Item) => {
    if (item) {
      addItemToCart(item);
    }
  };

  const handleProceedToPayment = () => {
    if (items.length === 0) {
      setModal({ message: 'Please add at least one item to the cart.', type: State.ERROR });
      return;
    }
    setIsDrawerOpen(true);
  };

  const handleSavePurchase = async (completionData: PaymentCompletionData) => {
    if (!currentUser) {
      throw new Error('User is not authenticated.');
    }
    const { paymentDetails, discount, finalAmount, partyName, partyNumber } = completionData;

    const purchaseData = {
      userId: currentUser.uid,
      partyName: partyName.trim(),
      partyNumber: partyNumber.trim(),
      discount,
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
      const updatePromises = items.map(item =>
        updateDoc(doc(db, "items", item.id), {
          amount: firebaseIncrement(item.quantity)
        })
      );
      await Promise.all(updatePromises);

      setIsDrawerOpen(false);
      setModal({ message: 'Purchase saved successfully!', type: State.SUCCESS });

      setTimeout(() => {
        setModal(null);
        setItems([]);
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

  return (
    <div className="flex flex-col min-h-screen bg-white w-full pb-16">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />

      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600">&times;</button>
        <div className="flex-1 flex justify-center items-center gap-6">
          <NavLink to={`${ROUTES.PURCHASE}`} className={({ isActive }) => `flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500'}`}>Purchase</NavLink>
          <NavLink to={`${ROUTES.PURCHASE_RETURN}`} className={({ isActive }) => `flex-1 cursor-pointer border-b-2 py-3 text-center text-base font-medium transition hover:text-slate-700 ${isActive ? 'border-blue-600 font-semibold text-blue-600' : 'border-transparent text-slate-500'}`}>Purchase Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto box-border">
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

        <div className="mb-4">
          <div className="flex gap-2 items-end">
            <div className="flex-grow">
              <SearchableItemInput
                label="Search & Add Item"
                placeholder="Search by name or barcode..."
                items={availableItems}
                onItemSelected={handleItemSelected}
                isLoading={isLoading}
                error={error}
              />
            </div>
            <button onClick={() => setIsScannerOpen(true)} className="p-3 bg-gray-700 text-white rounded-md font-semibold transition hover:bg-gray-800" title="Scan Barcode">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
            </button>
          </div>
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