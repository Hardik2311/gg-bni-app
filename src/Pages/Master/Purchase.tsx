import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Item, Purchase as OriginalPurchase } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment as firebaseIncrement, getDoc } from 'firebase/firestore';
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
type Purchase = OriginalPurchase & { id: string };


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

  // New state for the "Print QR" confirmation modal
  const [showPrintQrModal, setShowPrintQrModal] = useState<PurchaseItem[] | null>(null);

  const [editModeData, setEditModeData] = useState<Purchase | null>(null);
  const purchaseIdToEdit = location.state?.purchaseId as string | undefined;

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!dbOperations) {
      setIsLoading(false);
      return;
    }

    const initializePage = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await dbOperations.getItems();
        setAvailableItems(fetchedItems);

        if (purchaseIdToEdit) {
          const purchaseDocRef = doc(db, 'purchases', purchaseIdToEdit);
          const docSnap = await getDoc(purchaseDocRef);
          if (docSnap.exists()) {
            const purchaseData = { id: docSnap.id, ...docSnap.data() } as Purchase;
            setEditModeData(purchaseData);
            setItems(purchaseData.items);
          } else {
            throw new Error("Purchase document not found.");
          }
        }
        setError(null);
      } catch (err: any) {
        console.error('Failed to initialize page:', err);
        setError('Failed to load data. Please try again later.');
        setTimeout(() => navigate(ROUTES.JOURNAL || ROUTES.PURCHASE), 2000);
      } finally {
        setIsLoading(false);
      }
    };

    initializePage();
  }, [dbOperations, purchaseIdToEdit, navigate]);

  const addItemToCart = (itemToAdd: Item) => {
    const itemExists = items.find((item) => item.id === itemToAdd.id);
    if (itemExists) {
      setItems((prevItems) =>
        prevItems.map((item: PurchaseItem) =>
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
          mrp: itemToAdd.mrp || 0,
          barcode: itemToAdd.barcode || '',
          quantity: 1,
        },
      ]);
    }
  };

  const totalAmount = useMemo(() => items.reduce((sum, item) => sum + item.purchasePrice * item.quantity, 0), [items]);

  const handleQuantityChange = (id: string, delta: number) => {
    setItems((prevItems) =>
      prevItems.map((item: PurchaseItem) =>
        item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.id !== id));
  };

  const handleItemSelected = (item: Item | null) => {
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
    if (!currentUser) throw new Error('User is not authenticated.');

    if (editModeData) {
      await updateExistingPurchase(completionData);
    } else {
      await createNewPurchase(completionData);
    }
  };

  const createNewPurchase = async (completionData: PaymentCompletionData) => {
    const newInvoiceNumber = await PurchaseInvoiceNumber();
    const purchaseData = {
      userId: currentUser!.uid,
      partyName: completionData.partyName.trim(),
      partyNumber: completionData.partyNumber.trim(),
      invoiceNumber: newInvoiceNumber,
      discount: completionData.discount,
      items: items.map(({ id, name, purchasePrice, quantity }) => ({ id, name, purchasePrice, quantity })),
      totalAmount: completionData.finalAmount,
      paymentMethods: completionData.paymentDetails,
      createdAt: serverTimestamp(),
      companyId: currentUser!.companyId,
    };

    try {
      await addDoc(collection(db, 'purchases'), purchaseData);
      const updatePromises = items.map((item: PurchaseItem) =>
        updateDoc(doc(db, "items", item.id), { amount: firebaseIncrement(item.quantity) })
      );
      await Promise.all(updatePromises);

      // --- NEW LOGIC: Show QR modal instead of simple success modal ---
      setIsDrawerOpen(false);
      const savedItems = [...items]; // Keep a copy of the items
      setItems([]); // Clear the cart for the next purchase
      setShowPrintQrModal(savedItems); // Show the new modal with the saved items

    } catch (err) {
      console.error('Error saving purchase:', err);
      throw err;
    }
  };

  const updateExistingPurchase = async (completionData: PaymentCompletionData) => {
    if (!editModeData) return;
    const updatedPurchaseData = {
      partyName: completionData.partyName.trim(),
      partyNumber: completionData.partyNumber.trim(),
      discount: completionData.discount,
      items: items.map(({ id, name, purchasePrice, quantity }) => ({ id, name, purchasePrice, quantity })),
      totalAmount: completionData.finalAmount,
      paymentMethods: completionData.paymentDetails,
    };

    try {
      const stockUpdatePromises = calculateStockChanges();
      const purchaseUpdatePromise = updateDoc(doc(db, 'purchases', editModeData.id), updatedPurchaseData);
      await Promise.all([...stockUpdatePromises, purchaseUpdatePromise]);
      // For updates, we just show a simple success and navigate away
      showSuccessModal('Purchase updated successfully!', ROUTES.JOURNAL || ROUTES.JOURNAL);
    } catch (err) {
      console.error('Error updating purchase:', err);
      throw err;
    }
  };

  const calculateStockChanges = () => {
    if (!editModeData) return [];
    const originalItems = new Map(editModeData.items.map((item: PurchaseItem) => [item.id, item.quantity]));
    const currentItems = new Map(items.map((item: PurchaseItem) => [item.id, item.quantity]));
    const allItemIds = new Set([...originalItems.keys(), ...currentItems.keys()]);
    const updatePromises: Promise<void>[] = [];

    allItemIds.forEach(id => {
      const oldQty = originalItems.get(id) || 0;
      const newQty = currentItems.get(id) || 0;
      const difference = newQty - oldQty;

      if (difference !== 0) {
        const itemRef = doc(db, 'items', id);
        updatePromises.push(updateDoc(itemRef, { amount: firebaseIncrement(difference) }));
      }
    });
    return updatePromises;
  };

  const showSuccessModal = (message: string, navigateTo?: string) => {
    setIsDrawerOpen(false);
    setModal({ message, type: State.SUCCESS });
    setTimeout(() => {
      setModal(null);
      if (navigateTo) {
        navigate(navigateTo);
      } else {
        setItems([]);
      }
    }, 1500);
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

  // --- New handlers for the QR Print Modal ---
  const handleNavigateToQrPage = () => {
    if (showPrintQrModal) {
      // Ensure QR_GENERATOR route exists in your routes constants
      navigate(ROUTES.PAYMENT, { state: { prefilledItems: showPrintQrModal } });
      setShowPrintQrModal(null);
    }
  };

  const handleCloseQrModal = () => {
    setShowPrintQrModal(null);
  };


  return (
    <div className="flex flex-col min-h-screen bg-white w-full pb-16">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />

      {/* --- New QR Print Modal --- */}
      {showPrintQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800">Purchase Saved!</h3>
            <p className="my-4 text-gray-600">Do you want to print QR codes for the purchased items?</p>
            <div className="flex justify-end gap-4 mt-6">
              <CustomButton variant={Variant.Outline} onClick={handleCloseQrModal}>
                No, thanks
              </CustomButton>
              <CustomButton variant={Variant.Filled} onClick={handleNavigateToQrPage}>
                Yes, Print QR
              </CustomButton>
            </div>
          </div>
        </div>
      )}


      <div className="flex flex-col p-1 bg-white border-b border-gray-200 shadow-sm flex-shrink-0">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">{editModeData ? 'Edit Purchase' : 'Purchase'}</h1>
        <div className="flex items-center justify-center gap-6">
          <CustomButton variant={Variant.Transparent} onClick={() => navigate(ROUTES.PURCHASE)} active={isActive(ROUTES.PURCHASE)}>Purchase</CustomButton>
          <CustomButton variant={Variant.Transparent} onClick={() => navigate(ROUTES.PURCHASE_RETURN)} active={isActive(ROUTES.PURCHASE_RETURN)}>Purchase Return</CustomButton>
        </div>
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
              <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg">{isLoading ? 'Loading...' : 'No items added.'}</div>
            ) : (
              items.map((item: PurchaseItem) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex justify-between items-start">
                    <div><p className="font-semibold text-gray-800">{item.name.slice(0, 25)}</p></div>
                    <button onClick={() => handleDeleteItem(item.id)} className="text-gray-500 hover:text-red-500 flex-shrink-0 ml-4" title="Remove item"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                  </div>
                  <div className="flex justify-between items-center mt-2"><p className="text-sm text-gray-500">₹{item.purchasePrice.toFixed(2)}</p></div>
                  <hr className="my-3 border-gray-200" />
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-600">Qty</p>
                    <div className="flex items-center gap-5 text-lg">
                      <button onClick={() => handleQuantityChange(item.id, -1)} disabled={item.quantity === 1} className="text-gray-700 hover:text-black disabled:text-gray-300 font-semibold">-</button>
                      <span className="font-bold text-gray-900 w-8 text-center">{item.quantity}</span>
                      <button onClick={() => handleQuantityChange(item.id, 1)} className="text-gray-700 hover:text-black font-semibold">+</button>
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
        <CustomButton onClick={handleProceedToPayment} variant={Variant.Filled} className="w-full flex items-center justify-center py-4 text-xl font-semibold">
          {editModeData ? 'Update Purchase' : 'Proceed to Payment'}
        </CustomButton>
      </div>

      <PaymentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        subtotal={totalAmount}
        onPaymentComplete={handleSavePurchase}
        isPartyNameEditable={!editModeData}
        initialPartyName={editModeData ? editModeData.partyName : ''}
        initialPartyNumber={editModeData ? editModeData.partyNumber : ''}
      />
    </div>
  );
};

export default PurchasePage;