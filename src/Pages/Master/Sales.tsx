import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth, useDatabase } from '../../context/auth-context';
import type { Item, SalesItem as OriginalSalesItem } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { collection, serverTimestamp, doc, increment as firebaseIncrement, runTransaction } from 'firebase/firestore';
import SearchableItemInput from '../../UseComponents/SearchIteminput';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
import { generateNextInvoiceNumber } from '../../UseComponents/InvoiceCounter';
import { Modal } from '../../constants/Modal';
import { Permissions, State, Variant } from '../../enums';
import { CustomButton } from '../../Components';
import type { User } from '../../Role/permission';


// MODIFIED: 'customPrice' can be a string during editing to allow an empty input
interface SalesItem extends OriginalSalesItem {
  isEditable: boolean;
  customPrice?: number | string;
}

const applyRounding = (amount: number): number => {
  if (amount < 100) {
    return Math.ceil(amount / 5) * 5;
  }
  return Math.ceil(amount / 10) * 10;
};

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, loading: authLoading, hasPermission } = useAuth();
  const dbOperations = useDatabase();

  const invoiceToEdit = location.state?.invoiceData;
  const isEditMode = location.state?.isEditMode === true && invoiceToEdit;

  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<SalesItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [pageIsLoading, setPageIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isDiscountLocked, setIsDiscountLocked] = useState(true);
  const [discountInfo, setDiscountInfo] = useState<string | null>(null);
  const [workers, setWorkers] = useState<User[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<User | null>(null);
  const isActive = (path: string) => location.pathname === path;


  useEffect(() => {
    if (authLoading || !currentUser || !dbOperations) {
      setPageIsLoading(authLoading);
      return;
    }

    const fetchData = async () => {
      try {
        setPageIsLoading(true);
        setError(null);
        const [fetchedItems, fetchedWorkers] = await Promise.all([
          dbOperations.getItems(),
          dbOperations.getWorkers()
        ]);

        setAvailableItems(fetchedItems);
        setWorkers(fetchedWorkers);

        if (isEditMode) {
          const originalSalesman = fetchedWorkers.find(u => u.uid === invoiceToEdit.salesmanId);
          setSelectedWorker(originalSalesman || null);
        } else {
          const currentUserAsWorker = fetchedWorkers.find(u => u.uid === currentUser.uid);
          setSelectedWorker(currentUserAsWorker || null);
        }

      } catch (err) {
        const errorMessage = 'Failed to load initial page data.';
        setError(errorMessage);
        console.error(errorMessage, err);
      } finally {
        setPageIsLoading(false);
      }
    };

    fetchData();
  }, [authLoading, currentUser, dbOperations, isEditMode, invoiceToEdit]);

  useEffect(() => {
    if (isEditMode) {
      const nonEditableItems = invoiceToEdit.items.map((item: any) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
        isEditable: false,
        customPrice: item.effectiveUnitPrice
      }));
      setItems(nonEditableItems);
    }
  }, [isEditMode, invoiceToEdit]);

  const { subtotal, totalDiscount, roundOff, finalAmount } = useMemo(() => {
    let subtotal = 0;
    let preDiscountTotal = 0;
    let finalAmount = 0;

    items.forEach(item => {
      const itemSubtotal = item.mrp * item.quantity;
      subtotal += itemSubtotal;

      const priceAfterDiscount = item.mrp * (1 - (item.discount || 0) / 100);
      preDiscountTotal += priceAfterDiscount * item.quantity;

      const calculatedRoundedPrice = (item.discount && item.discount > 0)
        ? applyRounding(priceAfterDiscount)
        : priceAfterDiscount;

      // MODIFIED: Logic now handles customPrice being a string (during editing) or a number
      let effectiveUnitPrice = calculatedRoundedPrice;
      if (item.customPrice !== undefined && item.customPrice !== null) {
        // Coerce to string for parseFloat to safely handle numbers or strings
        const numericPrice = parseFloat(String(item.customPrice));
        if (!isNaN(numericPrice)) {
          effectiveUnitPrice = numericPrice;
        }
      }

      finalAmount += effectiveUnitPrice * item.quantity;
    });

    const totalDiscountValue = subtotal - finalAmount;
    const roundOffValue = finalAmount - preDiscountTotal;

    return {
      subtotal,
      totalDiscount: totalDiscountValue,
      roundOff: roundOffValue,
      finalAmount,
    };
  }, [items]);


  const amountToPayNow = useMemo(() => {
    if (!isEditMode) {
      return finalAmount;
    }
    const alreadyPaidAmount = Object.entries(invoiceToEdit.paymentMethods || {}).reduce((sum, [key, value]) => {
      return key === 'due' ? sum : sum + Number(value);
    }, 0);

    return finalAmount - alreadyPaidAmount;
  }, [isEditMode, finalAmount, invoiceToEdit]);

  const addItemToCart = (itemToAdd: Item) => {
    const itemExists = items.find(item => item.id === itemToAdd.id);
    if (itemExists) {
      if (itemExists.isEditable) {
        setItems(prev => prev.map(item =>
          item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
        ));
      } else {
        setModal({ message: `${itemToAdd.name} is already in the original invoice. New items can be added.`, type: State.INFO });
      }
    } else {
      setItems(prev => [...prev, {
        id: itemToAdd.id!,
        name: itemToAdd.name,
        mrp: itemToAdd.mrp,
        quantity: 1,
        discount: itemToAdd.discount || 0,
        isEditable: true,
      }]);
    }
  };

  const handleItemSelected = (selectedItem: Item) => {
    if (selectedItem) addItemToCart(selectedItem);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setIsScannerOpen(false);
    if (!dbOperations) return;

    const itemToAdd = await dbOperations.getItemByBarcode(barcode);
    if (itemToAdd) {
      addItemToCart(itemToAdd);
    } else {
      setModal({ message: 'Item not found for this barcode.', type: State.ERROR });
    }
  };

  const handleQuantityChange = (id: string, delta: number) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const handleDeleteItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDiscountPressStart = () => {
    longPressTimer.current = setTimeout(() => setIsDiscountLocked(false), 500);
  };

  const handleDiscountPressEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const handleDiscountClick = () => {
    if (isDiscountLocked) {
      setDiscountInfo("Cannot edit the discount");
      setTimeout(() => setDiscountInfo(null), 3000);
    }
  };

  const handleDiscountChange = (id: string, discountValue: number) => {
    const newDiscount = Math.max(0, Math.min(100, discountValue || 0));
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, discount: newDiscount, customPrice: undefined } : item
    ));
  };

  // MODIFIED: Stores the raw string value from the input to allow empty strings
  const handleCustomPriceChange = (id: string, value: string) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, customPrice: value } : item
    ));
  };

  // ADDED: Handles parsing and reverting logic when the user leaves the input field
  const handleCustomPriceBlur = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id && typeof item.customPrice === 'string') {
        const numericValue = parseFloat(item.customPrice);
        if (isNaN(numericValue)) {
          // Revert if empty or invalid string on blur
          return { ...item, customPrice: undefined };
        }
        // Solidify the valid numeric value (e.g., "0" becomes 0)
        return { ...item, customPrice: numericValue };
      }
      return item;
    }));
  };


  const handleProceedToPayment = () => {
    if (items.length === 0) {
      setModal({ message: 'Please add at least one item to the cart.', type: State.INFO });
      return;
    }
    if (!selectedWorker) {
      setModal({ message: 'Please select a user to attribute the sale to.', type: State.ERROR });
      return;
    }
    setIsDrawerOpen(true);
  };

  const handleSavePayment = async (completionData: PaymentCompletionData) => {
    if (!currentUser || !selectedWorker) {
      setModal({ type: State.ERROR, message: "Could not process sale. Worker not selected." });
      return;
    }

    const formatItemsForDB = (itemsToFormat: SalesItem[]) => {
      return itemsToFormat.map(({ isEditable, customPrice, ...item }) => {
        const priceAfterDiscount = item.mrp * (1 - (item.discount || 0) / 100);
        const calculatedRoundedPrice = (item.discount && item.discount > 0)
          ? applyRounding(priceAfterDiscount)
          : priceAfterDiscount;

        // MODIFIED: Same robust parsing as in useMemo to get the final numeric value
        let effectiveUnitPrice = calculatedRoundedPrice;
        if (customPrice !== undefined && customPrice !== null) {
          const numericPrice = parseFloat(String(customPrice));
          if (!isNaN(numericPrice)) {
            effectiveUnitPrice = numericPrice;
          }
        }

        const finalPriceForStack = effectiveUnitPrice * item.quantity;

        return {
          ...item,
          finalPrice: finalPriceForStack,
          effectiveUnitPrice: effectiveUnitPrice,
          discountPercentage: item.discount || 0,
        };
      });
    };

    if (isEditMode) {
      const newItems = items.filter(item => item.isEditable);

      try {
        await runTransaction(db, async (transaction) => {
          const invoiceRef = doc(db, "sales", invoiceToEdit.id);
          const invoiceDoc = await transaction.get(invoiceRef);
          if (!invoiceDoc.exists()) throw new Error("Original invoice not found.");

          for (const newItem of newItems) {
            const itemRef = doc(db, "items", newItem.id);
            transaction.update(itemRef, { stock: firebaseIncrement(-newItem.quantity) });
          }

          const originalItems = invoiceDoc.data().items || [];
          const updatedItems = [...originalItems, ...formatItemsForDB(newItems)];

          const originalPayments = invoiceDoc.data().paymentMethods || {};
          const newPayments = completionData.paymentDetails;
          const mergedPayments = { ...originalPayments };
          for (const method in newPayments) {
            mergedPayments[method] = (mergedPayments[method] || 0) + newPayments[method];
          }

          transaction.update(invoiceRef, {
            items: updatedItems,
            subtotal, discount: totalDiscount, roundOff, totalAmount: finalAmount,
            paymentMethods: mergedPayments,
            updatedAt: serverTimestamp(),
            partyName: completionData.partyName.trim(),
            partyNumber: completionData.partyNumber.trim(),
          });
        });
        setModal({ message: `Invoice #${invoiceToEdit.invoiceNumber} updated successfully!`, type: State.SUCCESS });
        navigate(ROUTES.JOURNAL);
      } catch (error: any) {
        console.error("Failed to update invoice:", error);
        setModal({ message: `Update failed: ${error.message}`, type: State.ERROR });
      }
    } else {
      const { paymentDetails, partyName, partyNumber } = completionData;
      const newInvoiceNumber = await generateNextInvoiceNumber();

      try {
        await runTransaction(db, async (transaction) => {
          const saleData = {
            invoiceNumber: newInvoiceNumber,
            userId: currentUser.uid,
            salesmanId: selectedWorker.uid,
            salesmanName: selectedWorker.name || 'N/A',
            partyName: partyName.trim(),
            partyNumber: partyNumber.trim(),
            items: formatItemsForDB(items),
            subtotal,
            discount: totalDiscount,
            roundOff,
            totalAmount: finalAmount,
            paymentMethods: paymentDetails,
            createdAt: serverTimestamp(),
            companyId: currentUser.companyId,
          };
          const newSaleRef = doc(collection(db, "sales"));
          transaction.set(newSaleRef, saleData);
          items.forEach(cartItem => {
            const itemRef = doc(db, "items", cartItem.id);
            transaction.update(itemRef, { stock: firebaseIncrement(-cartItem.quantity) });
          });
        });
        setIsDrawerOpen(false);
        setItems([]);
        setModal({ message: `Sale #${newInvoiceNumber} completed successfully!`, type: State.SUCCESS });
      } catch (error: any) {
        console.error("Sale transaction failed:", error);
        setModal({ message: `Sale failed: ${error.message}`, type: State.ERROR });
      }
    }
  };

  if (authLoading || pageIsLoading) {
    return <div className="flex items-center justify-center h-full">Loading sales data...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 w-full overflow-hidden pb-10 ">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />
      <div className="flex flex-col bg-gray-100 border-b border-gray-200 shadow-sm flex-shrink-0 mb-2">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-2">{isEditMode ? `Editing Invoice #${invoiceToEdit.invoiceNumber}` : 'Sales'}</h1>
        {!isEditMode && (
          <div className="flex items-center justify-center gap-6 mb-2">
            <CustomButton variant={Variant.Transparent} onClick={() => navigate(ROUTES.SALES)} active={isActive(ROUTES.SALES)}>Sales</CustomButton>
            <CustomButton variant={Variant.Transparent} onClick={() => navigate(ROUTES.SALES_RETURN)} active={isActive(ROUTES.SALES_RETURN)}>Sales Return</CustomButton>
          </div>
        )}
      </div>
      <div className="flex-shrink-0 p-2 bg-white border-b pb-3 mb-2 rounded-sm">
        <div className="flex gap-4 items-end w-full">
          <div className="flex-grow">
            <SearchableItemInput
              label="Search Item"
              placeholder="Search by name or barcode..."
              items={availableItems}
              onItemSelected={handleItemSelected}
              isLoading={pageIsLoading}
              error={error}
            />
          </div>
          <button onClick={() => setIsScannerOpen(true)} className='bg-transparent text-gray-700 p-3 border border-gray-700 rounded-md font-semibold transition hover:bg-gray-800' title="Scan Barcode">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-100 overflow-y-hidden">
        <div className="pt-2 flex-shrink-0 grid grid-cols-2 border-b pb-2">
          <h3 className="text-gray-700 text-base font-medium">Cart</h3>
          <div className="flex items-center gap-2">
            <label htmlFor="worker-select" className="block text-sm text-gray-700 mb-1">Salesman</label>
            <select
              value={selectedWorker?.uid || ''}
              onChange={(e) => setSelectedWorker(workers.find(s => s.uid === e.target.value) || null)}
              className="w-23 p-1 border rounded-md shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              disabled={!hasPermission(Permissions.ViewTransactions) || isEditMode}
            >
              {workers.map(w => <option key={w.uid} value={w.uid}>{w.name || 'Unnamed'}</option>)}
            </select>
          </div>
          {discountInfo && (
            <div className="flex items-center text-sm mt-4 p-3 bg-yellow-100 text-yellow-800 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              <span>{discountInfo}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-1">
          <div className="flex flex-col gap-3">
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-sm">No items added.</div>
            ) : (
              [...items].reverse().map(item => {
                const priceAfterDiscount = item.mrp * (1 - (item.discount || 0) / 100);
                const calculatedRoundedPrice = (item.discount && item.discount > 0) ? applyRounding(priceAfterDiscount) : priceAfterDiscount;

                const displayPrice = item.customPrice !== undefined && item.customPrice !== null
                  ? item.customPrice.toString()
                  : calculatedRoundedPrice.toFixed(2);

                return (
                  <div key={item.id} className={`bg-white rounded-sm shadow-sm border p-2 ${!item.isEditable ? 'bg-gray-100 opacity-75' : ''}`}>
                    <div className="flex justify-between items-start">
                      <p className="font-semibold text-gray-800">{item.name.slice(0, 25)}</p>
                      <button onClick={() => handleDeleteItem(item.id)} disabled={!item.isEditable} className="text-black-400 hover:text-red-500 flex-shrink-0 ml-4 disabled:text-gray-300 disabled:cursor-not-allowed" title="Remove item">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                      </button>
                    </div>

                    <div className="flex justify-between items-center mb-1">
                      <div
                        className="flex items-center gap-2"
                        onMouseDown={handleDiscountPressStart}
                        onMouseUp={handleDiscountPressEnd}
                        onMouseLeave={handleDiscountPressEnd}
                        onTouchStart={handleDiscountPressStart}
                        onTouchEnd={handleDiscountPressEnd}
                        onClick={handleDiscountClick}
                      >
                        <label htmlFor={`discount-${item.id}`} className={`text-sm text-gray-600`}>Approx. Discount</label>
                        <input
                          id={`discount-${item.id}`} type="number" value={item.discount || ''}
                          onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value))}
                          readOnly={isDiscountLocked || !item.isEditable}
                          className={`w-10 p-1 bg-gray-100 rounded-md text-center text-sm font-medium text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDiscountLocked || !item.isEditable ? 'cursor-not-allowed' : ''}`}
                          placeholder="0"
                        />
                        <span className="text-sm text-gray-600 pr-20">%</span>
                      </div>
                    </div>
                    <hr className="my-1 border-gray-200" />

                    <div className="flex justify-between items-center">
                      <div className="flex items-baseline gap-2">
                        <p className="text-sm text-gray-500 line-through">₹{item.mrp.toFixed(2)}</p>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold text-gray-600 mr-1">₹</span>
                          <input
                            type="number"
                            value={displayPrice}
                            onChange={(e) => handleCustomPriceChange(item.id, e.target.value)}
                            onBlur={() => handleCustomPriceBlur(item.id)}
                            disabled={!item.isEditable}
                            className="w-16 mr-10 p-1 bg-gray-100 rounded-sm text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 disabled:cursor-not-allowed"
                            step="0.01"
                            placeholder='Price'
                          />
                        </div>
                      </div>
                      <p className="text-sm font-medium text-gray-600">Qty</p>
                      <div className="flex items-center gap-2 text-lg border border-gray-300 rounded-md">
                        <button onClick={() => handleQuantityChange(item.id, -1)} disabled={item.quantity === 1 || !item.isEditable} className="text-gray-700 pl-4 hover:text-black disabled:text-gray-300 disabled:cursor-not-allowed">-</button>
                        <span className="font-bold text-gray-900 w-8 border-l border-r rounded-none p-0 focus:ring-0 text-center">{item.quantity}</span>
                        <button onClick={() => handleQuantityChange(item.id, 1)} disabled={!item.isEditable} className="text-gray-700 pr-4 hover:text-black font-semibold disabled:text-gray-300 disabled:cursor-not-allowed">+</button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      <div className="pl-4 pr-4 flex-shrink-0 p-2 rounded-sm bg-white border-t shadow-[0_-2px_5px_rgba(0,0,0,0.05)] mb-2">
        {isEditMode ? (
          <>
            <div className="flex justify-between items-center mb-1">
              <p className="text-md">Subtotal</p>
              <p className="text-md">₹{subtotal.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center mb-1 text-red-600">
              <p className="text-md">Discount</p>
              <p className="text-md">- ₹{totalDiscount.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center mb-1 border-t pt-1">
              <p className="text-lg font-medium">Total Amount</p>
              <p className="text-2xl font-bold">₹{finalAmount.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-md font-medium text-[#00A8E8]">Amount Due </p>
              <p className="text-md font-bold text-[#00A8E8]">₹{amountToPayNow.toFixed(2)}</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-1">
              <p className="text-md">Subtotal</p>
              <p className="text-md">₹{subtotal.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center mb-1 text-red-600">
              <p className="text-md">Discount</p>
              <p className="text-md">- ₹{totalDiscount.toFixed(2)}</p>
            </div>
            <div className="flex justify-between items-center border-t pt-3">
              <p className="text-lg font-medium">Total Amount</p>
              <p className="text-lg font-bold">₹{finalAmount.toFixed(2)}</p>
            </div>
          </>
        )}
      </div>
      <div className="items-center px-16 py-1 mb-4">
        <CustomButton onClick={handleProceedToPayment} variant={Variant.Payment} className="w-full flex items-center justify-center py-4 text-xl font-semibold">
          {isEditMode ? 'Update & Proceed to Payment' : 'Proceed to Payment'}
        </CustomButton>
      </div>
      <PaymentDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        subtotal={amountToPayNow}
        onPaymentComplete={handleSavePayment}
        isPartyNameEditable={!isEditMode}
        initialPartyName={isEditMode ? invoiceToEdit.partyName : ''}
        initialPartyNumber={isEditMode ? invoiceToEdit.partyNumber : ''}
      />
    </div>
  );
};

export default Sales;