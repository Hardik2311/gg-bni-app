import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import type { Item, ItemGroup } from '../../constants/models';
import { ROUTES } from '../../constants/routes.constants';
import { CustomButton } from '../../Components';
import { Variant } from '../../enums';
import * as XLSX from 'xlsx';
import BarcodeScanner from '../../UseComponents/BarcodeScanner';
import { useAuth, useDatabase } from '../../context/auth-context';

const ItemAdd: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dbOperations = useDatabase();
  const { currentUser } = useAuth();

  const [itemName, setItemName] = useState<string>('');
  const [itemMRP, setItemMRP] = useState<string>('');
  const [itemPurchasePrice, setItemPurchasePrice] = useState<string>('');
  const [itemDiscount, setItemDiscount] = useState<string>('');
  const [itemTax, setItemTax] = useState<string>('');
  const [itemAmount, setItemAmount] = useState<string>('');
  const [restockQuantity, setRestockQuantity] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [itemBarcode, setItemBarcode] = useState<string>('');
  const [itemGroups, setItemGroups] = useState<ItemGroup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // The isActive function now correctly uses the `location` hook
  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    if (!dbOperations) {
      setLoading(false);
      return;
    }

    const fetchGroups = async () => {
      try {
        setLoading(true);
        const groups = await dbOperations.getItemGroups();
        setItemGroups(groups);
        if (groups.length > 0 && !selectedCategory) {
          setSelectedCategory(groups[0].id!);
        }
      } catch (err) {
        console.error('Failed to fetch item groups:', err);
        setError('Failed to load item categories. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [dbOperations, selectedCategory]);

  const resetForm = () => {
    setItemName('');
    setItemMRP('');
    setItemPurchasePrice('');
    setItemDiscount('');
    setItemTax('');
    setItemAmount('');
    setItemBarcode('');
    setRestockQuantity('');
  };

  const handleAddItem = async () => {
    if (!dbOperations || !currentUser) {
      setError('Cannot add item. User or database not ready.');
      return;
    }
    setError(null);
    setSuccess(null);

    if (!itemName.trim() || !itemMRP.trim() || !selectedCategory || !itemAmount.trim()) {
      setError('Please fill in all required fields: Item Name, MRP, Amount, and Category.');
      return;
    }
    try {
      const newItemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> = {
        name: itemName.trim(),
        mrp: parseFloat(itemMRP),
        purchasePrice: parseFloat(itemPurchasePrice) || 0,
        discount: parseFloat(itemDiscount) || 0,
        tax: parseFloat(itemTax) || 0,
        itemGroupId: selectedCategory,
        amount: parseInt(itemAmount, 10),
        barcode: itemBarcode.trim() || '',
        restockQuantity: parseInt(restockQuantity, 10) || 0,
      };

      await dbOperations.createItem(newItemData);
      setSuccess(`Item "${itemName}" added successfully!`);
      resetForm();
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      console.error('Error adding item:', err);
      setError('Failed to add item. Please try again.');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !dbOperations || !currentUser) return;

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        if (json.length === 0) {
          throw new Error("The selected Excel file is empty or in the wrong format.");
        }

        let processedCount = 0;
        for (const row of json) {
          if (
            !row.name ||
            row.mrp == null ||
            !row.itemGroupId ||
            row.amount == null
          ) {
            console.warn("Skipping invalid row (missing required fields):", row);
            continue;
          }

          const newItemData: Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'companyId'> = {
            name: String(row.name).trim(),
            mrp: parseFloat(String(row.mrp)),
            purchasePrice: parseFloat(String(row.purchasePrice)) || 0,
            discount: parseFloat(String(row.discount)) || 0,
            tax: parseFloat(String(row.tax)) || 0,
            itemGroupId: String(row.itemGroupId),
            amount: parseInt(String(row.amount), 10),
            barcode: String(row.barcode || '').trim(),
            restockQuantity: parseInt(String(row.restockQuantity), 10) || 0,
          };

          await dbOperations.createItem(newItemData);
          processedCount++;
        }

        setSuccess(`${processedCount} items have been successfully imported!`);
        setTimeout(() => setSuccess(null), 5000);

      } catch (err) {
        console.error('Error processing Excel file:', err);
        setError('Failed to process file. Check format and required columns.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBarcodeScanned = (barcode: string) => {
    setItemBarcode(barcode);
    setIsScannerOpen(false);
  };

  return (
    <div className="relative flex flex-col min-h-screen bg-gray-100 w-full font-poppins text-gray-800">
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleBarcodeScanned}
      />

      {/* Header with Title and Navigation Buttons */}
      <div className="fixed top-0 left-0 right-0 z-10 p-4 bg-gray-100 border-b border-gray-300  flex flex-col">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-4">Add Item</h1>
        <div className="flex items-center justify-center gap-6">
          <CustomButton
            variant={Variant.Transparent}
            onClick={() => navigate(ROUTES.ITEM_ADD)}
            active={isActive(ROUTES.ITEM_ADD)}
          >
            Item Add
          </CustomButton>
          <CustomButton
            variant={Variant.Transparent}
            onClick={() => navigate(ROUTES.ITEM_GROUP)}
            active={isActive(ROUTES.ITEM_GROUP)}
          >
            Item Groups
          </CustomButton>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-grow p-2 md:p-6 mt-28 bg-gray-100 w-full overflow-y-auto mb-10">
        {error && <div className="mb-4 text-center p-3 bg-red-100 text-red-700 rounded-lg font-medium">{error}</div>}
        {success && <div className="mb-4 text-center p-3 bg-green-100 text-green-700 rounded-lg font-medium">{success}</div>}

        {/* Bulk Import Section */}
        <div className="bg-white p-2 rounded-lg shadow-md mb-4">
          <div className="flex flex-col items-center justify-center mb-4 ">
            <h2 className="text-lg font-semibold text-gray-700 mb-2">Bulk Import</h2>
            <p className="text-sm text-center text-gray-500 mb-4 max-w-sm">
              Upload an EXCEL file with columns: Name, MRP, Purchase Price, Discount, Tax, Item Group ID, Amount and Barcode, RestockQuantity.
            </p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".xlsx, .csv"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full max-w-xs bg-sky-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-sky-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center text-lg"
            >
              {isUploading ? 'Uploading...' : 'Import from Excel'}
            </button>
          </div>
        </div>

        {/* Add a Single Item Section */}
        <div className="bg-white p-6 rounded-lg shadow-md mb-24 ">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Add a Single Item</h2>
          <div className="space-y-4">
            {/* Item Name */}
            <div>
              <label htmlFor="itemName" className="block text-sm font-medium text-gray-600 mb-1">Item Name</label>
              <input type="text" id="itemName" value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="e.g., Laptop, Keyboard" className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" />
            </div>

            {/* Barcode with Scanner Button */}
            <div>
              <label htmlFor="itemBarcode" className="block text-sm font-medium text-gray-600 mb-1">Barcode (Optional)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="itemBarcode"
                  value={itemBarcode}
                  onChange={(e) => setItemBarcode(e.target.value)}
                  placeholder="e.g., Laptop, Keyboard"
                  className="flex-grow w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500"
                />
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-gray-700 text-white p-3 rounded-md font-semibold transition hover:bg-gray-800 flex items-center justify-center"
                  title="Scan Barcode"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path><circle cx="12" cy="13" r="3"></circle></svg>
                </button>
              </div>
            </div>

            {/* Grid of inputs */}
            <div className='grid grid-cols-2 gap-4'>
              {/* MRP */}
              <div>
                <label htmlFor="itemMRP" className="block text-sm font-medium text-gray-600 mb-1">MRP</label>
                <input type="number" id="itemMRP" value={itemMRP} onChange={(e) => setItemMRP(e.target.value)} placeholder="00.00" className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" />
              </div>
              {/* Purchase Price */}
              <div>
                <label htmlFor="itemPurchasePrice" className="block text-sm font-medium text-gray-600 mb-1">Purchase Price</label>
                <input type="number" id="itemPurchasePrice" value={itemPurchasePrice} onChange={(e) => setItemPurchasePrice(e.target.value)} placeholder="00.00" className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" />
              </div>
              {/* Item Discount */}
              <div>
                <label htmlFor="itemDiscount" className="block text-sm font-medium text-gray-600 mb-1">Item Discount (%)</label>
                <input type="number" id="itemDiscount" value={itemDiscount} onChange={(e) => setItemDiscount(e.target.value)} placeholder="00.00" className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" />
              </div>
              {/* Tax */}
              <div>
                <label htmlFor="itemTax" className="block text-sm font-medium text-gray-600 mb-1">Tax (%)</label>
                <input type="number" id="itemTax" value={itemTax} onChange={(e) => setItemTax(e.target.value)} placeholder="00.00" className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" />
              </div>
              {/* Stock Quantity */}
              <div>
                <label htmlFor="itemAmount" className="block text-sm font-medium text-gray-600 mb-1">Stock Quantity</label>
                <input type="number" id="itemAmount" value={itemAmount} onChange={(e) => setItemAmount(e.target.value)} placeholder="00.00" className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" />
              </div>
              {/* Restock Quantity */}
              <div>
                <label htmlFor="restockQuantity" className="block text-sm font-medium text-gray-600 mb-1">Restock Quantity</label>
                <input type="number" id="restockQuantity" value={restockQuantity} onChange={(e) => setRestockQuantity(e.target.value)} placeholder="00.00" className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label htmlFor="itemCategory" className="block text-sm font-medium text-gray-600 mb-1">Category</label>
              {loading ? <p>Loading categories...</p> : (
                <select id="itemCategory" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500">
                  <option value="">Select a category</option>
                  {itemGroups.map((group) => (
                    <option key={group.id} value={group.id!}>{group.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gray-100 flex items-center justify-center pb-18">
        <button
          onClick={handleAddItem}
          className="bg-sky-500 text-white py-3 px-6 rounded-lg text-lg font-semibold shadow-md hover:bg-sky-600 transition-colors"
        >
          Add Item
        </button>
      </div>
    </div>
  );
};

export default ItemAdd;
