import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Item, Purchase as OriginalPurchase, SalesItem } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { collection, serverTimestamp, doc, increment as firebaseIncrement, getDoc, runTransaction, query, where, getDocs } from 'firebase/firestore';
import { useAuth, useDatabase } from '../../context/auth-context';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
import { Modal } from '../../constants/Modal';
import { State, Variant } from '../../enums';
import SearchableItemInput from '../../UseComponents/SearchIteminput';
import { CustomButton } from '../../Components';
import { generateNextInvoiceNumber } from '../../UseComponents/InvoiceCounter';
import { Spinner } from '../../constants/Spinner';
import { FiEdit } from 'react-icons/fi';
import { ItemEditDrawer } from '../../Components/ItemDrawer';
import { usePurchaseSettings } from '../../context/Settingscontext';

// --- MODIFIED: Interface now includes tax fields ---
interface PurchaseItem extends Omit<SalesItem, 'finalPrice' | 'effectiveUnitPrice' | 'discountPercentage'> {
  purchasePrice: number;
  barcode?: string;
  taxRate?: number; // Added
  taxType?: 'inclusive' | 'exclusive' | 'none'; // Added
  taxAmount?: number; // Added
  taxableAmount?: number; // Added
  Stock: number; // Use capital 'S'
}

// --- MODIFIED: Document data updated for GST ---
interface PurchaseDocumentData extends Omit<OriginalPurchase, 'items' | 'paymentMethods'> {
  userId: string;
  partyName: string;
  partyNumber: string;
  invoiceNumber: string;
  items: PurchaseItem[];
  subtotal: number;
  totalDiscount?: number;
  taxableAmount?: number;
  taxAmount?: number;
  gstScheme?: 'regular' | 'composition' | 'none'; // Added
  taxType?: 'inclusive' | 'exclusive' | 'none';  // Kept for record
  totalAmount: number;
  paymentMethods: { [key: string]: number };
  createdAt: any;
  companyId: string;
  voucherName?: string;
  roundingOff?: number;
  updatedAt?: any;
}

type Purchase = PurchaseDocumentData & { id: string };

const applyPurchaseRounding = (amount: number, isRoundingEnabled: boolean): number => {
  if (!isRoundingEnabled) {
    return amount;
  }
  return Math.round(amount);
};


const PurchasePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading: authLoading } = useAuth();
  const dbOperations = useDatabase();
  const { purchaseSettings, loadingSettings: loadingPurchaseSettings } = usePurchaseSettings();

  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [pageIsLoading, setPageIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const [showPrintQrModal, setShowPrintQrModal] = useState<PurchaseItem[] | null>(null);

  const [editModeData, setEditModeData] = useState<Purchase | null>(null);
  const purchaseIdToEdit = location.state?.purchaseId as string | undefined;

  const [settingsDocId, setSettingsDocId] = useState<string | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    setPageIsLoading(authLoading || loadingPurchaseSettings);
  }, [authLoading, loadingPurchaseSettings]);


  useEffect(() => {
    const findSettingsDocId = async () => {
      if (currentUser?.companyId) {
        const settingsQuery = query(collection(db, 'settings'), where('companyId', '==', currentUser.companyId), where('settingType', '==', 'purchase'));
        const settingsSnapshot = await getDocs(settingsQuery);
        if (!settingsSnapshot.empty) {
          setSettingsDocId(settingsSnapshot.docs[0].id);
        } else {
          console.warn("Purchase settings document ID not found on initial load.");
        }
      }
    };
    findSettingsDocId();

    if (pageIsLoading || !dbOperations || !currentUser) return;

    const initializePage = async () => {
      try {
        const fetchedItems = await dbOperations.getItems(); // Make sure this fetches taxRate and Stock
        setAvailableItems(fetchedItems);

        if (purchaseIdToEdit) {
          const purchaseDocRef = doc(db, 'purchases', purchaseIdToEdit);
          const docSnap = await getDoc(purchaseDocRef);
          if (docSnap.exists()) {
            const purchaseData = { id: docSnap.id, ...docSnap.data() } as Purchase;
            const validatedItems = (purchaseData.items || []).map((item: any) => ({
              id: item.id || crypto.randomUUID(),
              name: item.name || 'Unknown Item',
              purchasePrice: item.purchasePrice || 0,
              quantity: item.quantity || 1,
              mrp: item.mrp || 0,
              discount: item.discount || 0,
              barcode: item.barcode || '',
              taxRate: item.taxRate || 0, // Load taxRate
              taxType: item.taxType,
              taxAmount: item.taxAmount,
              taxableAmount: item.taxableAmount,
              Stock: item.Stock || item.stock || 0, // Check for both
            }));
            setEditModeData(purchaseData);
            setItems(validatedItems);
          } else {
            throw new Error("Purchase document not found.");
          }
        } else {
          setEditModeData(null);
          setItems([]);
        }
        setError(null);
      } catch (err: any) {
        console.error('Failed to initialize page:', err);
        setError('Failed to load data. Navigating back.');
        setTimeout(() => navigate(-1), 3000);
      }
    };

    initializePage();
  }, [dbOperations, currentUser, purchaseIdToEdit, pageIsLoading, navigate]);


  // --- MODIFIED: Added taxRate and fixed Stock ---
  const addItemToCart = (itemToAdd: Item) => {
    if (!itemToAdd || !itemToAdd.id) {
      console.error("Attempted to add invalid item:", itemToAdd);
      setModal({ message: "Cannot add invalid item.", type: State.ERROR });
      return;
    }

    const itemExists = items.find((item) => item.id === itemToAdd.id);

    if (itemExists) {
      setItems((prevItems) =>
        prevItems.map((item: PurchaseItem) =>
          item.id === itemToAdd.id ? { ...item, quantity: (item.quantity || 0) + 1 } : item
        )
      );
    } else {
      const defaultDiscount = purchaseSettings?.defaultDiscount ?? 0;
      setItems((prevItems) => [
        ...prevItems,
        {
          id: itemToAdd.id!,
          name: itemToAdd.name || 'Unnamed Item',
          purchasePrice: itemToAdd.purchasePrice || 0,
          mrp: itemToAdd.mrp || 0,
          barcode: itemToAdd.barcode || '',
          quantity: 1,
          discount: defaultDiscount,
          taxRate: itemToAdd.taxRate || 0, // <-- Get taxRate from item
          Stock: itemToAdd.stock || 0,   // <-- Use capital 'S'
        },
      ]);
    }
  };

  // --- MODIFIED: This entire hook is replaced with GST logic ---
  const {
    subtotal,         // This is the total purchase price (pre-tax if exclusive)
    taxableAmount,
    taxAmount,
    roundingOffAmount,
    finalAmount,
    totalDiscount     // Kept your MRP vs PP logic
  } = useMemo(() => {
    // Get settings
    const gstScheme = purchaseSettings?.gstScheme ?? 'none';
    const taxType = purchaseSettings?.taxType ?? 'exclusive'; // Used by 'regular' and 'composition'
    const isRoundingEnabled = purchaseSettings?.roundingOff ?? true;

    let mrpTotalAgg = 0;
    let purchasePriceTotalAgg = 0; // This is the subtotal
    let totalTaxableBaseAgg = 0;
    let totalTaxAgg = 0;
    let finalAmountAggPreRounding = 0;

    items.forEach(item => {
      const purchasePrice = item.purchasePrice || 0;
      const quantity = item.quantity || 1;
      const itemTaxRate = item.taxRate || 0;
      const mrp = item.mrp || 0;

      // Calculate totals based on MRP and Purchase Price
      mrpTotalAgg += mrp * quantity;
      const itemTotalPurchasePrice = purchasePrice * quantity;
      purchasePriceTotalAgg += itemTotalPurchasePrice;

      // 3. Calculate Tax based on GST Scheme and Type
      let itemTaxableBase = 0;
      let itemTax = 0;
      let itemFinalTotal = 0;

      if (gstScheme === 'regular' || gstScheme === 'composition') {
        if (taxType === 'exclusive') {
          // Purchase price is the base
          itemTaxableBase = itemTotalPurchasePrice;
          itemTax = itemTaxableBase * (itemTaxRate / 100);
          itemFinalTotal = itemTaxableBase + itemTax;
        } else {
          // 'inclusive'
          // Purchase price includes tax
          itemFinalTotal = itemTotalPurchasePrice;
          itemTaxableBase = itemTotalPurchasePrice / (1 + (itemTaxRate / 100));
          itemTax = itemTotalPurchasePrice - itemTaxableBase;
        }
      } else {
        // gstScheme === 'none'
        itemTaxableBase = itemTotalPurchasePrice;
        itemTax = 0;
        itemFinalTotal = itemTaxableBase;
      }

      // 4. Aggregate totals
      totalTaxableBaseAgg += itemTaxableBase;
      totalTaxAgg += itemTax;
      finalAmountAggPreRounding += itemFinalTotal;
    });

    // 5. Calculate Final Aggregates
    const roundedAmount = applyPurchaseRounding(finalAmountAggPreRounding, isRoundingEnabled);
    const currentRoundingOffAmount = roundedAmount - finalAmountAggPreRounding;
    const currentTotalDiscount = mrpTotalAgg - purchasePriceTotalAgg; // Your original logic

    return {
      subtotal: purchasePriceTotalAgg, // Subtotal is total of purchase prices
      totalDiscount: currentTotalDiscount > 0 ? currentTotalDiscount : 0,
      taxableAmount: totalTaxableBaseAgg,
      taxAmount: totalTaxAgg,
      roundingOffAmount: currentRoundingOffAmount,
      finalAmount: roundedAmount, // Final rounded amount
    };
  }, [items, purchaseSettings]);


  const handleQuantityChange = (id: string, delta: number) => {
    setItems((prevItems) =>
      prevItems.map((item: PurchaseItem) =>
        item.id === id ? { ...item, quantity: Math.max(1, (item.quantity || 1) + delta) } : item
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
      setModal({ message: 'Please add items to purchase.', type: State.ERROR });
      return;
    }

    if (purchaseSettings?.zeroValueValidation) {
      const hasZeroValueItem = items.some(item => (item.purchasePrice || 0) <= 0);
      if (hasZeroValueItem) {
        setModal({ message: 'Cannot proceed: One or more items have a zero or negative purchase price.', type: State.ERROR });
        return;
      }
    }

    if (purchaseSettings?.inputMRP) {
      const missingMrpItem = items.find(item => (item.mrp === undefined || item.mrp === null || item.mrp <= 0));
      if (missingMrpItem) {
        setModal({ message: `Cannot proceed: MRP is required but missing or invalid for "${missingMrpItem.name}". Please input MRP for all items.`, type: State.ERROR });
        return;
      }
    }

    setIsDrawerOpen(true);
  };


  // --- MODIFIED: This function is heavily updated ---
  const handleSavePurchase = async (completionData: PaymentCompletionData) => {
    if (!currentUser?.companyId) {
      setModal({ message: 'User or company information missing.', type: State.ERROR });
      return;
    }

    // Required field checks (Unchanged)
    if (purchaseSettings?.requireSupplierName && !completionData.partyName.trim()) { setModal({ message: 'Supplier name is required.', type: State.ERROR }); setIsDrawerOpen(true); return; }
    if (purchaseSettings?.requireSupplierMobile && !completionData.partyNumber.trim()) { setModal({ message: 'Supplier mobile is required.', type: State.ERROR }); setIsDrawerOpen(true); return; }

    // 1. Determine final tax settings from GST Scheme
    const gstScheme = purchaseSettings?.gstScheme ?? 'none';
    const taxType = purchaseSettings?.taxType ?? 'exclusive';

    let finalTaxType: 'inclusive' | 'exclusive' | 'none';
    if (gstScheme === 'none') {
      finalTaxType = 'none';
    } else {
      finalTaxType = taxType; // Use the setting for both 'regular' and 'composition'
    }

    // 2. Create a proper formatting function (replaces simple map)
    const formatItemsForDB = (itemsToFormat: PurchaseItem[]): PurchaseItem[] => {
      return itemsToFormat.map((item) => {
        const purchasePrice = item.purchasePrice || 0;
        const quantity = item.quantity || 1;
        const itemTaxRate = item.taxRate || 0;
        const itemTotalPurchasePrice = purchasePrice * quantity;

        let itemTaxableBase = 0;
        let itemTax = 0;

        if (finalTaxType === 'exclusive') {
          itemTaxableBase = itemTotalPurchasePrice;
          itemTax = itemTaxableBase * (itemTaxRate / 100);
        } else if (finalTaxType === 'inclusive') {
          itemTaxableBase = itemTotalPurchasePrice / (1 + (itemTaxRate / 100));
          itemTax = itemTotalPurchasePrice - itemTaxableBase;
        } else { // 'none'
          itemTaxableBase = itemTotalPurchasePrice;
          itemTax = 0;
        }

        return {
          ...item,
          taxableAmount: parseFloat(itemTaxableBase.toFixed(2)),
          taxAmount: parseFloat(itemTax.toFixed(2)),
          taxRate: itemTaxRate,
          taxType: finalTaxType,
        };
      });
    };

    const formattedItemsForDB = formatItemsForDB(items);

    if (editModeData && purchaseIdToEdit) {
      await updateExistingPurchase(purchaseIdToEdit, completionData, formattedItemsForDB, gstScheme, finalTaxType);
    } else {
      await createNewPurchase(completionData, formattedItemsForDB, gstScheme, finalTaxType);
    }
  };

  const createNewPurchase = async (
    completionData: PaymentCompletionData,
    formattedItemsForDB: PurchaseItem[], // Use correct type
    gstScheme: 'regular' | 'composition' | 'none',
    finalTaxType: 'inclusive' | 'exclusive' | 'none'
  ) => {
    if (!currentUser?.companyId) return;

    try {
      const newInvoiceNumber = await generateNextInvoiceNumber();
      await runTransaction(db, async (transaction) => {
        const purchaseData: Omit<PurchaseDocumentData, 'id'> = {
          userId: currentUser.uid,
          partyName: completionData.partyName.trim(),
          partyNumber: completionData.partyNumber.trim(),
          invoiceNumber: newInvoiceNumber,
          items: formattedItemsForDB, // Save fully calculated items
          subtotal: subtotal,
          totalDiscount: totalDiscount,
          taxableAmount: taxableAmount, // From useMemo
          taxAmount: taxAmount,         // From useMemo
          gstScheme: gstScheme,       // Save scheme
          taxType: finalTaxType,      // Save tax type
          roundingOff: roundingOffAmount, // From useMemo
          totalAmount: finalAmount,       // From useMemo
          paymentMethods: completionData.paymentDetails,
          createdAt: serverTimestamp(),
          companyId: currentUser.companyId!,
          voucherName: purchaseSettings?.voucherName ?? 'Purchase',
        };

        const newPurchaseRef = doc(collection(db, 'purchases'));
        transaction.set(newPurchaseRef, purchaseData);

        formattedItemsForDB.forEach(item => {
          const itemRef = doc(db, "items", item.id);
          transaction.update(itemRef, {
            Stock: firebaseIncrement(item.quantity || 1), // <-- FIX: Use 'Stock'
            purchasePrice: item.purchasePrice,
            mrp: item.mrp,
            taxRate: item.taxRate, // Also update tax rate on the item
          });
        });

        if (settingsDocId) {
          const settingsRef = doc(db, "settings", settingsDocId);
          transaction.update(settingsRef, {
            currentVoucherNumber: firebaseIncrement(1)
          });
        } else {
          console.error("CRITICAL: Purchase settings document ID not found. Cannot increment voucher number.");
          throw new Error("Settings document not found for voucher increment.");
        }
      });

      setIsDrawerOpen(false);
      const savedItemsCopy = [...items];
      if (!purchaseSettings?.copyVoucherAfterSaving) {
        setItems([]);
      }
      if (purchaseSettings?.enableBarcodePrinting) {
        setShowPrintQrModal(savedItemsCopy);
      } else {
        setModal({ message: `Purchase #${newInvoiceNumber} saved!`, type: State.SUCCESS });
        setTimeout(() => { setModal(null); }, 1500);
      }
    } catch (err: any) {
      console.error('Error saving purchase:', err);
      setModal({ message: `Save failed: ${err.message || 'Unknown error'}`, type: State.ERROR });
    }
  };


  const updateExistingPurchase = async (
    purchaseId: string,
    completionData: PaymentCompletionData,
    formattedItemsForDB: PurchaseItem[], // Use correct type
    gstScheme: 'regular' | 'composition' | 'none',
    finalTaxType: 'inclusive' | 'exclusive' | 'none'
  ) => {
    if (!editModeData) return;

    try {
      await runTransaction(db, async (transaction) => {
        const purchaseRef = doc(db, 'purchases', purchaseId);
        const purchaseDoc = await transaction.get(purchaseRef);
        if (!purchaseDoc.exists()) throw new Error("Purchase not found.");

        const originalItemsMap = new Map(
          (purchaseDoc.data().items as PurchaseItem[] || []).map(item => [item.id, item.quantity || 1])
        );
        const currentItemsMap = new Map(
          formattedItemsForDB.map(item => [item.id, item.quantity || 1])
        );
        const allItemIds = new Set([...originalItemsMap.keys(), ...currentItemsMap.keys()]);

        allItemIds.forEach(id => {
          const oldQty = originalItemsMap.get(id) || 0;
          const newQty = currentItemsMap.get(id) || 0;
          const difference = newQty - oldQty;

          if (difference !== 0) {
            const itemRef = doc(db, 'items', id);
            transaction.update(itemRef, { Stock: firebaseIncrement(difference) }); // <-- FIX: Use 'Stock'
          }
        });

        formattedItemsForDB.forEach(item => {
          const itemRef = doc(db, "items", item.id);
          transaction.update(itemRef, {
            purchasePrice: item.purchasePrice,
            mrp: item.mrp,
            taxRate: item.taxRate, // Also update tax rate
          });
        });

        const updatedPurchaseData: Partial<PurchaseDocumentData> = {
          partyName: completionData.partyName.trim(),
          partyNumber: completionData.partyNumber.trim(),
          items: formattedItemsForDB,
          subtotal: subtotal,
          totalDiscount: totalDiscount,
          taxableAmount: taxableAmount,   // From useMemo
          taxAmount: taxAmount,       // From useMemo
          gstScheme: gstScheme,     // Save scheme
          taxType: finalTaxType,    // Save tax type
          roundingOff: roundingOffAmount, // From useMemo
          totalAmount: finalAmount,     // From useMemo
          paymentMethods: completionData.paymentDetails,
          updatedAt: serverTimestamp(),
        };

        transaction.update(purchaseRef, updatedPurchaseData);
      });
      showSuccessModal('Purchase updated successfully!', ROUTES.JOURNAL);
    } catch (err: any) {
      console.error('Error updating purchase:', err);
      setModal({ message: `Update failed: ${err.message || 'Unknown error'}`, type: State.ERROR });
    }
  };

  const showSuccessModal = (message: string, navigateTo?: string) => {
    setIsDrawerOpen(false);
    setModal({ message, type: State.SUCCESS });
    setTimeout(() => {
      setModal(null);
      if (navigateTo) {
        navigate(navigateTo);
      } else if (!purchaseSettings?.copyVoucherAfterSaving) {
        setItems([]);
      }
    }, 1500);
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

  const handleNavigateToQrPage = () => {
    if (showPrintQrModal) {
      navigate(ROUTES.PRINTQR, { state: { prefilledItems: showPrintQrModal } });
      setShowPrintQrModal(null);
    }
  };

  const handleCloseQrModal = () => {
    setShowPrintQrModal(null);
  };

  // --- Item Edit Drawer Handlers (Unchanged) ---
  const [selectedItemForEdit, setSelectedItemForEdit] = useState<Item | null>(null);
  const [isItemDrawerOpen, setIsItemDrawerOpen] = useState(false);
  const handleOpenEditDrawer = (item: Item) => {
    setSelectedItemForEdit(item);
    setIsItemDrawerOpen(true);
  };
  const handleCloseEditDrawer = () => {
    setIsItemDrawerOpen(false);
    setTimeout(() => setSelectedItemForEdit(null), 300);
  };
  const handleSaveSuccess = (updatedItemData: Partial<Item>) => {
    // Update main item list
    setAvailableItems(prevItems => prevItems.map(item =>
      item.id === selectedItemForEdit?.id
        ? { ...item, ...updatedItemData, id: item.id } as Item
        : item
    ));
    // Update item in cart
    setItems(prevCartItems => prevCartItems.map(cartItem => {
      if (cartItem.id === selectedItemForEdit?.id) {
        return {
          ...cartItem,
          ...updatedItemData,
          id: cartItem.id,
        };
      }
      return cartItem;
    }));
    console.log("Item updated successfully.");
  };

  // --- Loading / Error (Unchanged) ---
  if (pageIsLoading) {
    return (<div className="flex items-center justify-center h-screen"><Spinner /> <p className="ml-2">Loading...</p></div>);
  }
  if (error) {
    return (<div className="flex flex-col items-center justify-center h-screen text-red-600"><p>{error}</p><button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Go Back</button></div>);
  }

  // --- MODIFIED: Get display settings for GST ---
  const gstSchemeDisplay = purchaseSettings?.gstScheme ?? 'none';
  const taxTypeDisplay = purchaseSettings?.taxType ?? 'exclusive';
  const isTaxInclusiveDisplay = (gstSchemeDisplay !== 'none' && taxTypeDisplay === 'inclusive');

  return (
    <div className="flex flex-col h-screen bg-gray-100 w-full">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />

      {/* (Print QR Modal unchanged) */}
      {showPrintQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm mx-4">
            <h3 className="text-lg font-bold text-gray-800">Purchase Saved!</h3>
            <p className="my-4 text-gray-600">Print barcodes/QR codes for the items?</p>
            <div className="flex justify-end gap-4 mt-6">
              <CustomButton variant={Variant.Outline} onClick={handleCloseQrModal}>No</CustomButton>
              <CustomButton variant={Variant.Filled} onClick={handleNavigateToQrPage}>Yes, Print</CustomButton>
            </div>
          </div>
        </div>
      )}

      {/* (Header unchanged) */}
      <div className="flex-shrink-0">
        <div className="flex flex-col p-1 bg-gray-100 border-b border-gray-300">
          <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">{editModeData ? 'Edit Purchase' : (purchaseSettings?.voucherName ?? 'Purchase')}</h1>
          {!editModeData && (
            <div className="flex items-center justify-center gap-6">
              <CustomButton variant={Variant.Transparent} onClick={() => navigate(ROUTES.PURCHASE)} active={isActive(ROUTES.PURCHASE)}>Purchase</CustomButton>
              <CustomButton variant={Variant.Transparent} onClick={() => navigate(ROUTES.PURCHASE_RETURN)} active={isActive(ROUTES.PURCHASE_RETURN)}>Purchase Return</CustomButton>
            </div>
          )}
        </div>
        <div className="p-4 bg-white border-b mt-2 rounded-sm">
          <div className="flex gap-2 items-end">
            <div className="flex-grow">
              <SearchableItemInput
                label="Search & Add Item"
                placeholder="Search by name or barcode..."
                items={availableItems}
                onItemSelected={handleItemSelected}
                isLoading={pageIsLoading}
                error={error}
              />
            </div>
            <button onClick={() => setIsScannerOpen(true)} className="p-3 bg-gray-700 text-white rounded-md font-semibold transition hover:bg-gray-800" title="Scan Barcode">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
            </button>
          </div>
        </div>
      </div>

      {/* (Cart list unchanged, still uses your Item Edit Drawer) */}
      <div className='flex-grow overflow-y-auto p-2'>
        <h3 className="text-gray-700 text-lg font-medium px-2 mb-2">Cart</h3>
        <div className="flex flex-col gap-2">
          {items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-sm">{pageIsLoading ? 'Loading...' : 'No items added.'}</div>
          ) : (
            items.map((item: PurchaseItem) => (
              <div key={item.id} className="relative bg-white rounded-lg shadow-sm border p-2 flex flex-col gap-1">
                <div className="flex justify-between items-start">
                  <button
                    onClick={() => {
                      const originalItem = availableItems.find(a => a.id === item.id);
                      if (originalItem) {
                        handleOpenEditDrawer(originalItem);
                      } else {
                        setModal({ message: "Cannot edit this item. Original data not found.", type: State.ERROR });
                      }
                    }}
                    className="absolute top-3 left-4 bg-gray-50 hover:bg-gray-100 "
                  >
                    <FiEdit className="h-5 w-5 md:h-4 md:w-4" />
                  </button>
                  <p className="font-semibold text-gray-800 pr-8 pl-10">{item.name}</p>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500"
                    title="Remove item"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center text-sm">
                    <label htmlFor={`price-${item.id}`} className="text-xs text-gray-500 mr-1">Price:</label>
                    <span className="text-xs mr-0.5">₹</span>
                    <input
                      id={`price-${item.id}`} type="text" inputMode="decimal"
                      value={item.purchasePrice ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '' || /^[0-9]*\.?[0-9]*$/.test(val)) {
                          setItems(prev => prev.map(i => i.id === item.id ? { ...i, purchasePrice: val === '' ? 0 : parseFloat(val) || 0 } : i))
                        }
                      }}
                      className="w-16 p-0.5 text-sm font-medium" placeholder="0.00"
                    />
                  </div>
                </div>

                <hr className="my-1 border-gray-200" />

                <div className="flex justify-between items-center">
                  <p className="font-medium text-sm text-gray-600">Quantity</p>
                  <div className="flex items-center gap-3 text-lg border border-gray-300 rounded-md">
                    <button onClick={() => handleQuantityChange(item.id, -1)} disabled={item.quantity <= 1} className="px-3 py-0.5 text-gray-700 hover:bg-gray-100 rounded-l-md disabled:text-gray-300">-</button>
                    <span className="font-bold text-gray-900 w-8 text-center border-l border-r px-2">{item.quantity}</span>
                    <button onClick={() => handleQuantityChange(item.id, 1)} className="px-3 py-0.5 text-gray-700 hover:bg-gray-100 rounded-r-md font-semibold">+</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* --- MODIFIED: Summary box updated for GST --- */}
      <div className="flex-shrink-0 p-4 bg-white border-t rounded-sm shadow-[0_-2px_5px_rgba(0,0,0,0.05)] mb-4">
        {gstSchemeDisplay !== 'none' ? (
          <>
            <div className="flex justify-between items-center text-sm">
              <p className="text-gray-600">Subtotal (Purchase Price)</p>
              <p className="text-gray-800">₹{subtotal.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center text-sm">
              <p className="text-gray-600">Taxable Amount</p>
              <p className="text-gray-800">₹{taxableAmount.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center text-sm text-blue-600">
              <p>Total Tax {isTaxInclusiveDisplay ? '(Incl.)' : ''}</p>
              <p>₹{taxAmount.toFixed(2)}</p>
            </div>
          </>
        ) : (
          <div className="flex justify-between items-center text-sm">
            <p className="text-gray-600">Subtotal</p>
            <p className="text-gray-800">₹{subtotal.toFixed(2)}</p>
          </div>
        )}
        <div className="flex justify-between items-center mt-2 border-t pt-2">
          <p className="text-gray-700 text-lg font-medium">Total Amount</p>
          <p className="text-gray-900 text-2xl font-bold">₹{finalAmount.toFixed(2)}</p>
        </div>
      </div>

      {/* (Button and drawers unchanged) */}
      <div className="px-14 py-1 mb-24">
        <CustomButton onClick={handleProceedToPayment} variant={Variant.Payment} className="w-full flex items-center justify-center py-4 text-xl font-semibold" disabled={items.length === 0}>
          {editModeData ? 'Update Purchase' : 'Proceed to Payment'}
        </CustomButton>
      </div>


      <PaymentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        subtotal={finalAmount}
        onPaymentComplete={handleSavePurchase}
        isPartyNameEditable={!editModeData}
        initialPartyName={editModeData ? editModeData.partyName : ''}
        initialPartyNumber={editModeData ? editModeData.partyNumber : ''}
      />
      <ItemEditDrawer
        item={selectedItemForEdit}
        isOpen={isItemDrawerOpen}
        onClose={handleCloseEditDrawer}
        onSaveSuccess={handleSaveSuccess}
      />
    </div>
  );
};

export default PurchasePage;