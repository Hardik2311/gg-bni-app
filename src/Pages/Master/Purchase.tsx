import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { getItems } from '../../lib/items_firebase';
import type { Item } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment as firebaseIncrement } from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
import { Modal } from '../../constants/Modal';
import { State } from '../../enums';
import SearchableItemInput from '../../UseComponents/SearchIteminput';
import { generateNextPurchaseInvoiceNumber } from '../../UseComponents/InvoiceCounter';


interface PurchaseItem {
  id: string;
  name: string;
  purchasePrice: number;
  quantity: number;
}

const PurchasePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
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

  const handleItemSelected = (item: Item) => {
    if (item) {
      addItemToCart(item);
    }
  };

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0), [items]);

  const handleQuantityChange = (id: string, delta: number) => { setItems((prevItems) => prevItems.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item,),); };
  const handleDeleteItem = (id: string) => { setItems((prevItems) => prevItems.filter((item) => item.id !== id)); };

  const handleProceedToPayment = () => {
    if (items.length === 0) {
      setModal({ message: 'Please add at least one item to the cart.', type: State.ERROR });
      return;
    }
    setIsDrawerOpen(true);
  };

  const updateItemStock = async (itemId: string, quantityAdded: number) => {
    const itemRef = doc(db, "items", itemId);
    await updateDoc(itemRef, { amount: firebaseIncrement(quantityAdded) });
  };

  const handleSavePurchase = async (completionData: PaymentCompletionData) => {
    if (!currentUser) throw new Error('User is not authenticated.');
    const { paymentDetails, discount, finalAmount, partyName, partyNumber } = completionData;

    const newInvoiceNumber = await generateNextPurchaseInvoiceNumber();

    const purchaseData = {
      invoiceNumber: newInvoiceNumber,
      userId: currentUser.uid,
      partyName: partyName.trim(),
      partyNumber: partyNumber.trim(),
      discount: discount,
      items: items.map(({ id, name, purchasePrice, quantity }) => ({ id, name, purchasePrice, quantity })),
      totalAmount: finalAmount,
      paymentMethods: paymentDetails,
      createdAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'purchases'), purchaseData);
    const updatePromises = items.map(item => updateItemStock(item.id, item.quantity));
    await Promise.all(updatePromises);

    setIsDrawerOpen(false);
    setItems([]);
    setModal({ message: `Purchase #${newInvoiceNumber} saved successfully!`, type: State.SUCCESS });
  };

  const handleBarcodeScanned = (barcode: string) => {
    setIsScannerOpen(false);
    const itemToAdd = availableItems.find(item => item.barcode === barcode);
    if (itemToAdd) {
      addItemToCart(itemToAdd);
    } else {
      setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
    }
  };


  return (
    <div className="flex flex-col h-full bg-white w-full overflow-hidden">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />

      <div className="flex-shrink-0 flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm z-30">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600">&times;</button>
        <div className="flex-1 flex justify-center items-center gap-6">
          <NavLink to={`${ROUTES.PURCHASE}`} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Purchase</NavLink>
          <NavLink to={`${ROUTES.PURCHASE_RETURN}`} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Purchase Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-shrink-0 p-4 bg-gray-50 z-20 border-b">
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
          <button onClick={() => setIsScannerOpen(true)} className="flex-shrink-0 bg-gray-700 text-white p-3 rounded-md font-semibold transition hover:bg-gray-800" title="Scan Barcode">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        <h3 className="text-gray-700 text-lg font-medium mb-4">Cart</h3>
        <div className="flex flex-col gap-3">
          {items.length === 0 ? <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg">No items added to the list.</div> : items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex justify-between items-start">
                <p className="font-semibold text-gray-800">{item.name}</p>
                <button onClick={() => handleDeleteItem(item.id)} className="text-gray-400 hover:text-red-500 flex-shrink-0 ml-4" title="Remove item">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                </button>
              </div>
              <hr className="my-3 border-gray-200" />
              <div className="flex justify-between items-center">
                <p className="font-medium text-gray-600">₹{item.purchasePrice.toFixed(2)}</p>
                <div className="flex items-center gap-5 text-lg">
                  <button onClick={() => handleQuantityChange(item.id, -1)} disabled={item.quantity === 1} className="text-gray-700 hover:text-black disabled:text-gray-300 font-semibold">-</button>
                  <span className="font-bold text-gray-900 w-8 text-center">{item.quantity}</span>
                  <button onClick={() => handleQuantityChange(item.id, 1)} className="text-gray-700 hover:text-black font-semibold">+</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t border-gray-200 shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-3">
          <p className="text-gray-700 text-lg font-medium">Total Amount</p>
          <p className="text-gray-900 text-2xl font-bold">₹{totalAmount.toFixed(2)}</p>
        </div>
        <button onClick={handleProceedToPayment} className="w-full bg-blue-600 text-white p-3 rounded-lg text-lg font-semibold shadow-md transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled={items.length === 0}>Proceed to Payment</button>
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