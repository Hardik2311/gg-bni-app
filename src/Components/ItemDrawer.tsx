import React, { useState, useEffect, useRef } from 'react';
import type { Item } from '../constants/models'; // Adjust path as needed
import { useDatabase } from '../context/auth-context'; // Adjust path as needed
// Import FieldValue/Timestamp only if needed for ItemUpdatePayload definition consistency
import { FieldValue, Timestamp } from 'firebase/firestore';
import { FiSave, FiX } from 'react-icons/fi'; // Use FiX or FiXCircle for close icon
import { Spinner } from '../constants/Spinner'; // Adjust path as needed

// Interface for props
interface ItemEditDrawerProps {
    item: Item | null; // Item to edit (or null if none)
    isOpen: boolean;
    onClose: () => void;
    onSaveSuccess: (updatedItem: Partial<Item>) => void; // Callback with updated data
}

// Type for the update payload matching useDatabase's updateItem
// Make sure this aligns with the type definition in your useDatabase hook
type ItemUpdatePayload = Partial<Omit<Item, 'id' | 'createdAt' | 'companyId'>> & {
    createdAt?: FieldValue | Timestamp | number | null;
    updatedAt?: FieldValue | Timestamp | number | null; // Allow FieldValue/Timestamp/number based on updateItem type
    isListed?: boolean; // Ensure isListed is allowed
};


export const ItemEditDrawer: React.FC<ItemEditDrawerProps> = ({ item, isOpen, onClose, onSaveSuccess }) => {
    const dbOperations = useDatabase();
    const [formData, setFormData] = useState<Partial<Item>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const firstInputRef = useRef<HTMLInputElement>(null); // Ref for focusing first input

    // Effect to populate form when item changes or drawer opens
    useEffect(() => {
        if (isOpen && item) {
            setFormData({
                name: item.name || '',
                mrp: item.mrp ?? undefined,
                purchasePrice: item.purchasePrice ?? undefined,
                stock: item.stock ?? undefined, // Use lowercase 'stock'
                itemGroupId: item.itemGroupId || '', // Use correct case if needed
                barcode: item.barcode || '',
                tax: item.tax ?? undefined,
                discount: item.discount ?? undefined,
                isListed: item.isListed ?? false, // Initialize isListed
            });
            setError(null);
            const timer = setTimeout(() => {
                firstInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            // Clear form and state when closing
            setFormData({});
            setError(null);
            setIsSaving(false);
        }
    }, [isOpen, item]);

    // Handle input changes
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        // Handle checkbox type specifically
        const isCheckbox = type === 'checkbox';
        const checked = (e.target as HTMLInputElement).checked; // Get checked state for checkboxes

        const isNumericField = ['mrp', 'purchasePrice', 'stock', 'tax', 'discount'].includes(name);

        setFormData(prev => ({
            ...prev,
            // Keep value as string temporarily for controlled input, handle checkbox
            [name]: isCheckbox
                ? checked
                : (value === '' && isNumericField ? '' : (isNumericField ? parseFloat(value) : value))
        }));
    };

    // Handle save action
    const handleSave = async () => {
        if (!item || !item.id) return;

        setIsSaving(true);
        setError(null);

        try {
            // Prepare data for Firestore, converting empty strings/NaN to 0 or null/undefined
            const dataToUpdate: ItemUpdatePayload = {
                name: String(formData.name || ''),
                // Safely convert potentially empty strings or NaN to 0
                mrp: Number(formData.mrp || 0),
                purchasePrice: Number(formData.purchasePrice || 0),
                stock: Number(formData.stock || 0), // Use lowercase 'stock'
                tax: Number(formData.tax || 0),
                discount: Number(formData.discount || 0),
                itemGroupId: String(formData.itemGroupId || ''),
                barcode: String(formData.barcode || ''),
                isListed: formData.isListed ?? false, // Include isListed
                // 'updatedAt' is handled by dbOperations.updateItem function
            };

            await dbOperations.updateItem(item.id, dataToUpdate);

            // Prepare data for local state update (should match Item type)
            const dataForLocalState: Partial<Item> = {
                name: dataToUpdate.name,
                mrp: dataToUpdate.mrp,
                purchasePrice: dataToUpdate.purchasePrice,
                stock: dataToUpdate.stock,
                tax: dataToUpdate.tax,
                discount: dataToUpdate.discount,
                itemGroupId: dataToUpdate.itemGroupId,
                barcode: dataToUpdate.barcode,
                isListed: dataToUpdate.isListed,
                // Do not include FieldValue timestamps here for local state
            };

            onSaveSuccess(dataForLocalState); // Pass updated data back
            onClose(); // Close the drawer on success

        } catch (err: any) {
            console.error("Failed to save item:", err);
            setError(err.message || "Failed to save changes. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- CSS Transition Classes ---
    const drawerClasses = isOpen
        ? 'translate-y-0 opacity-100'
        : 'translate-y-full opacity-0 pointer-events-none'; // Added pointer-events-none when closed
    const overlayClasses = isOpen
        ? 'opacity-100 bg-black/60'
        : 'opacity-0 bg-transparent pointer-events-none';

    // --- Render ---
    return (
        // Overlay div
        <div
            className={`fixed inset-0 z-40 flex justify-center items-end transition-opacity duration-300 ease-in-out ${overlayClasses}`}
            onClick={onClose} // Close when clicking overlay
        >
            {/* Drawer Container */}
            <div
                className={`bg-white rounded-t-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden transform transition-all duration-300 ease-in-out ${drawerClasses}`}
                onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
            >
                {/* Header - Mimics shadcn DrawerHeader */}
                <div className="p-4 text-center relative border-b">
                    {/* Drag Handle */}
                    <div className="absolute left-1/2 top-2 -translate-x-1/2">
                        <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
                    </div>
                    {/* Title - Mimics shadcn DrawerTitle */}
                    <h2 className="text-lg font-semibold leading-none tracking-tight pt-4">
                        Edit Item
                    </h2>
                    {/* Description - Mimics shadcn DrawerDescription */}
                    <p className="text-sm text-muted-foreground mt-1 text-gray-500">
                        {item?.name || 'Item details'}
                    </p>
                    {/* Explicit Close Button - Mimics shadcn close style */}
                    <button
                        onClick={onClose}
                        className="absolute right-3 top-3 rounded-sm p-1 text-gray-500 hover:bg-gray-100 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                        aria-label="Close"
                    >
                        <FiX size={18} />
                    </button>
                </div>

                {/* Scrollable Content Area - Mimics shadcn DrawerContent padding */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {error && <p className="text-red-600 bg-red-100 p-3 rounded text-sm">{error}</p>}

                    {/* Form Fields - Mimicking shadcn Input/Label styles */}
                    <div>
                        <label htmlFor="edit-name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 mb-1 block">Name</label>
                        <input
                            ref={firstInputRef}
                            type="text" id="edit-name" name="name"
                            value={formData.name || ''} onChange={handleChange}
                            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" // Adjusted styles
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-itemGroupId" className="text-sm font-medium leading-none mb-1 block">Category</label>
                        <input
                            type="text" id="edit-itemGroupId" name="itemGroupId"
                            value={formData.itemGroupId || ''} onChange={handleChange}
                            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder="e.g., TY, DE"
                            disabled={isSaving}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="edit-mrp" className="text-sm font-medium leading-none mb-1 block">MRP (₹)</label>
                            <input
                                type="number" id="edit-mrp" name="mrp" step="0.01"
                                value={formData.mrp ?? ''} // Use ?? '' for input value
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label htmlFor="edit-purchasePrice" className="text-sm font-medium leading-none mb-1 block">Purchase (₹)</label>
                            <input
                                type="number" id="edit-purchasePrice" name="purchasePrice" step="0.01"
                                value={formData.purchasePrice ?? ''} // Use ?? ''
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="edit-stock" className="text-sm font-medium leading-none mb-1 block">Stock</label>
                            <input
                                type="number" id="edit-stock" name="stock" step="1" // lowercase 'stock'
                                value={formData.stock ?? ''} // Use ?? ''
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSaving}
                            />
                        </div>
                        <div>
                            <label htmlFor="edit-tax" className="text-sm font-medium leading-none mb-1 block">Tax (%)</label>
                            <input
                                type="number" id="edit-tax" name="tax" step="0.01"
                                value={formData.tax ?? ''} // Use ?? ''
                                onChange={handleChange}
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isSaving}
                            />
                        </div>
                    </div>
                    <div>
                        <label htmlFor="edit-discount" className="text-sm font-medium leading-none mb-1 block">Discount (%)</label>
                        <input
                            type="number" id="edit-discount" name="discount" step="0.01"
                            value={formData.discount ?? ''} // Use ?? ''
                            onChange={handleChange}
                            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isSaving}
                        />
                    </div>
                    <div>
                        <label htmlFor="edit-barcode" className="text-sm font-medium leading-none mb-1 block">Barcode</label>
                        <input
                            type="text" id="edit-barcode" name="barcode"
                            value={formData.barcode || ''} onChange={handleChange}
                            className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            disabled={isSaving}
                        />
                    </div>
                    {/* --- ADDED isListed Checkbox --- */}
                    <div className="flex items-center space-x-2 pt-2">
                        <input
                            type="checkbox"
                            id={`edit-isListed-${item?.id}`}
                            name="isListed"
                            checked={formData.isListed ?? false}
                            onChange={handleChange}
                            disabled={isSaving}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" // Added cursor-pointer
                        />
                        <label
                            htmlFor={`edit-isListed-${item?.id}`}
                            className="text-sm font-medium text-gray-700 select-none cursor-pointer" // Added cursor-pointer
                        >
                            List this item on Ordering Page
                        </label>
                    </div>
                    {/* ------------------------------- */}
                </div>

                {/* Footer with Actions - Mimics shadcn DrawerFooter */}
                <div className="mt-auto border-t p-4 flex gap-3">
                    {/* Save Button - Mimics shadcn default Button */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-black text-white hover:bg-gray-800 h-10 px-4 py-2 flex-1 gap-2 disabled:bg-gray-400" // Adjusted styles
                    >
                        {isSaving ? <Spinner /> : <FiSave size={16} />}
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                    {/* Cancel Button - Mimics shadcn outline Button */}
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-gray-300 bg-white hover:bg-gray-100 hover:text-gray-900 h-10 px-4 py-2 flex-1" // Adjusted styles
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};