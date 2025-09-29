import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
import { CustomButton } from '../../Components';
import { Variant } from '../../enums';
import { PurchaseInvoiceNumber } from '../../UseComponents/InvoiceCounter';


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
  const location = useLocation();
  const { currentUser } = useAuth();
  const dbOperations = useDatabase();
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // The isActive function now correctly uses the `location` hook
  const isActive = (path: string) => location.pathname === path;

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
    const newInvoiceNumber = await PurchaseInvoiceNumber();


    const purchaseData = {
      userId: currentUser.uid,
      partyName: partyName.trim(),
      partyNumber: partyNumber.trim(),
      invoiceNumber: newInvoiceNumber,
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

      <div className="flex flex-col p-1 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">Purchase</h1>
        <div className="flex items-center justify-center gap-6">
          <CustomButton
            variant={Variant.Transparent}
            onClick={() => navigate(ROUTES.PURCHASE)}
            active={isActive(ROUTES.PURCHASE)}
          >
            Purchase
          </CustomButton>
          <CustomButton
            variant={Variant.Transparent}
            onClick={() => navigate(ROUTES.PURCHASE_RETURN)}
            active={isActive(ROUTES.PURCHASE_RETURN)}
          >
            Purchase Return
          </CustomButton>
        </div>
        <div className="w-6"></div>
      </div>

      <div className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto box-border">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex flex-col gap-3">
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
            <div className="px-2 pt-2 flex-shrink-0">
              <h3 className="text-gray-700 text-lg font-medium">Cart</h3>
            </div>
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg">No items added.</div>
            ) : (
              items.map(item => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">{item.name.slice(0, 25)}</p>
                    </div>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-black-400 hover:text-red-500 flex-shrink-0 ml-4" title="Remove item">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-gray-500">₹{item.purchasePrice.toFixed(2)}</p>
                  </div>

                  <hr className="my-3 border-gray-200" />

                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-600">Qty</p>
                    <div className="flex items-center gap-5 text-lg">
                      <button onClick={() => handleQuantityChange(item.id, 1)} className="text-gray-700 hover:text-black font-semibold">+</button>
                      <span className="font-bold text-gray-900 w-8 text-center">{item.quantity}</span>
                      <button onClick={() => handleQuantityChange(item.id, -1)} disabled={item.quantity === 1} className="text-gray-700 hover:text-black disabled:text-gray-300 font-semibold">-</button>
                    </div>
                  </div>

                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <div className="flex-shrink-0 p-4 bg-white border-t shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
        <div className="flex justify-between items-center mb-3">
          <p className="text-gray-700 text-lg font-medium">Total Amount</p>
          <p className="text-gray-900 text-2xl font-bold">₹{totalAmount.toFixed(2)}</p>
        </div>
        <CustomButton onClick={handleProceedToPayment} variant={Variant.Filled} className=" flex items-center justify-center max-w-fit py-4 text-xl font-semibold">
          Proceed to Payment
        </CustomButton>
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
