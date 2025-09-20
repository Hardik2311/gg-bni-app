// src/pages/Sales.tsx

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, NavLink } from 'react-router-dom';
import { getItems, getItemByBarcode } from '../../lib/items_firebase';
import { getWorkers } from '../../lib/user_firebase';
import { type User } from '../../Role/permission';
import type { Item, SalesItem } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { db } from '../../lib/firebase';
import { addDoc, collection, serverTimestamp, doc, updateDoc, increment as firebaseIncrement } from 'firebase/firestore';
import { useAuth } from '../../context/auth-context';

import SearchableItemInput from '../../UseComponents/SearchIteminput';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import PaymentDrawer, { type PaymentCompletionData } from '../../Components/PaymentDrawer';
import { generateNextInvoiceNumber } from '../../UseComponents/InvoiceCounter';
import { Modal } from '../../constants/Modal';
import { Permissions, State, Variant } from '../../enums';
import { CustomButton } from '../../Components';
import PermissionWrapper from '../../context/PermissionWrapper';

const Sales: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [modal, setModal] = useState<{ message: string; type: State } | null>(null);
  const [items, setItems] = useState<SalesItem[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isDiscountLocked, setIsDiscountLocked] = useState(true);
  const [discountInfo, setDiscountInfo] = useState<string | null>(null);
  const [salesmen, setSalesmen] = useState<User[]>([]);
  const [selectedSalesman, setSelectedSalesman] = useState<User | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [fetchedItems, fetchedWorkers] = await Promise.all([
          getItems(),
          getWorkers()
        ]);

        setAvailableItems(fetchedItems);
        setSalesmen(fetchedWorkers);

        if (currentUser) {
          const currentSalesman = fetchedWorkers.find(u => u.uid === currentUser.uid);
          setSelectedSalesman(currentSalesman || null);
        }
      } catch (err) {
        setError('Failed to load initial data.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  const { subtotal, totalDiscount, roundOff, finalAmount } = useMemo(() => {
    const calc = items.reduce((acc, item) => {
      const itemTotal = item.mrp * item.quantity;
      const itemDiscount = item.discount ? (itemTotal * item.discount) / 100 : 0;
      acc.subtotal += itemTotal;
      acc.totalDiscount += itemDiscount;
      return acc;
    }, { subtotal: 0, totalDiscount: 0 });

    const totalBeforeRound = calc.subtotal - calc.totalDiscount;
    let roundedAmount;

    if (totalBeforeRound < 100) {
      roundedAmount = Math.ceil(totalBeforeRound / 5) * 5;
    } else {
      roundedAmount = Math.ceil(totalBeforeRound / 10) * 10;
    }
    const finalAmountValue = Math.min(roundedAmount, calc.subtotal);
    const roundOffValue = finalAmountValue - totalBeforeRound;

    return { ...calc, roundOff: roundOffValue, finalAmount: finalAmountValue };
  }, [items]);

  const addItemToCart = (itemToAdd: Item) => {
    const itemExists = items.find(item => item.id === itemToAdd.id);
    if (itemExists) {
      setItems(prev => prev.map(item =>
        item.id === itemToAdd.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setItems(prev => [...prev, {
        id: itemToAdd.id!,
        name: itemToAdd.name,
        mrp: itemToAdd.mrp,
        quantity: 1,
        discount: itemToAdd.discount || 0
      }]);
    }
  };

  const handleItemSelected = (selectedItem: Item) => {
    if (selectedItem) addItemToCart(selectedItem);
  };

  const handleBarcodeScanned = async (barcode: string) => {
    setIsScannerOpen(false);
    const itemToAdd = await getItemByBarcode(barcode);
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
      setDiscountInfo("Cannot edit Discount");
      setTimeout(() => setDiscountInfo(null), 3000);
    }
  };

  const handleDiscountChange = (id: string, discountValue: number) => {
    const newDiscount = Math.max(0, Math.min(100, discountValue || 0));
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, discount: newDiscount } : item
    ));
  };

  const handleProceedToPayment = () => {
    if (items.length === 0) {
      setModal({ message: 'Please add at least one item to the cart.', type: State.INFO });
      return;
    }
    setIsDrawerOpen(true);
  };

  const handleSavePayment = async (completionData: PaymentCompletionData) => {
    if (!currentUser || !selectedSalesman) throw new Error("User or salesman not selected.");
    const { paymentDetails, partyName, partyNumber } = completionData;
    const newInvoiceNumber = await generateNextInvoiceNumber();

    const saleData = {
      invoiceNumber: newInvoiceNumber,
      userId: currentUser.uid,
      salesmanId: selectedSalesman.uid,
      salesmanName: selectedSalesman.name || 'N/A',
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

    const updatePromises = items.map(item =>
      updateDoc(doc(db, "items", item.id), {
        amount: firebaseIncrement(-item.quantity)
      })
    );

    await addDoc(collection(db, "sales"), saleData);
    await Promise.all(updatePromises);

    setIsDrawerOpen(false);
    setItems([]);
    setModal({ message: `Sale #${newInvoiceNumber} completed successfully!`, type: State.SUCCESS });
  };

  return (
    <div className="flex flex-col h-full bg-white w-full overflow-hidden">
      {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
      <BarcodeScanner isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScanSuccess={handleBarcodeScanned} />
      <div className="flex-shrink-0 flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm z-30">
        <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600">&times;</button>
        <div className="flex-1 flex justify-center items-center gap-6">
          <NavLink to={ROUTES.SALES} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales</NavLink>
          <NavLink to={ROUTES.SALES_RETURN} className={({ isActive }) => `flex-1 text-center py-3 border-b-2 ${isActive ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-slate-500'}`}>Sales Return</NavLink>
        </div>
        <div className="w-6"></div>
      </div>
      <div className="flex-shrink-0 p-4 bg-gray-50 z-20 border-b">
        <PermissionWrapper requiredPermission={Permissions.ViewTransactions} behavior='hide'>
          <div className="mb-4">
            <label htmlFor="salesman-select" className="block text-sm font-medium text-gray-700 mb-1">
              Salesman
            </label>
            <select
              id="salesman-select"
              value={selectedSalesman?.uid || ''}
              onChange={(e) => {
                const salesman = salesmen.find(s => s.uid === e.target.value);
                if (salesman) setSelectedSalesman(salesman);
              }}
              className="w-full p-2 border border-gray-300 bg-white rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              disabled={salesmen.length === 0 || isLoading}
            >
              {isLoading ? (
                <option>Loading salesmen...</option>
              ) : (
                salesmen.map(s => (
                  <option key={s.uid} value={s.uid}>{s.name || 'Unnamed User'}</option>
                ))
              )}
            </select>
          </div>
        </PermissionWrapper>

        <div className="flex gap-2 items-end">
          <div className="flex-grow">
            <SearchableItemInput
              label="Search Item"
              placeholder="Search by name or barcode..."
              items={availableItems}
              onItemSelected={handleItemSelected}
              isLoading={isLoading}
              error={error}
            />
          </div>
          <CustomButton onClick={() => setIsScannerOpen(true)} variant={Variant.Transparent} className='flex-shrink-0' title="Scan Barcode">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
          </CustomButton>
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-gray-50 overflow-y-hidden">

        <div className="px-2 pt-2 flex-shrink-0">
          <h3 className="text-gray-700 text-lg font-medium">Cart</h3>
          {discountInfo && (
            <div className="flex items-center text-sm mt-4 p-3 bg-red-100 text-red-800 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              <span>{discountInfo}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto -p-4">
          <div className="flex flex-col gap-3">
            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-100 rounded-lg">No items added.</div>
            ) : (
              items.map(item => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">

                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-gray-800">{item.name.slice(0, 25)}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-black-400 hover:text-red-500 flex-shrink-0 ml-4"
                      title="Remove item"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                    </button>
                  </div>

                  <div className="flex justify-between items-center mt-2">
                    <p className="text-sm text-gray-500">₹{item.mrp.toFixed(2)}</p>

                    <div
                      className="flex items-center gap-2"
                      onMouseDown={handleDiscountPressStart}
                      onMouseUp={handleDiscountPressEnd}
                      onMouseLeave={handleDiscountPressEnd}
                      onTouchStart={handleDiscountPressStart}
                      onTouchEnd={handleDiscountPressEnd}
                      onClick={handleDiscountClick}
                    >
                      <label htmlFor={`discount-${item.id}`} className={`text-sm text-gray-600 ${isDiscountLocked ? 'cursor-pointer' : ''}`}>Discount</label>
                      <input
                        id={`discount-${item.id}`}
                        type="number"
                        value={item.discount || ''}
                        onChange={(e) => handleDiscountChange(item.id, parseFloat(e.target.value))}
                        readOnly={isDiscountLocked}
                        className={`w-14 p-1 bg-gray-100 rounded-md text-right font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDiscountLocked ? 'cursor-not-allowed' : ''}`}
                        placeholder="0"
                      />
                      <span className="text-sm text-gray-600">%</span>
                    </div>
                  </div>

                  <hr className="my-3 border-gray-200" />

                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-600">Qty -</p>
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

      <div className="flex-shrink-0 p-4  bg-white border-t shadow-[0_-2px_5px_rgba(0,0,0,0.05)]">
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
        <CustomButton onClick={handleProceedToPayment} variant={Variant.Filled} className="w-full py-4 text-xl font-semibold">
          Proceed to Payment
        </CustomButton>
      </div>
      <PaymentDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} subtotal={finalAmount} onPaymentComplete={handleSavePayment} />
    </div>
  );
};

export default Sales;