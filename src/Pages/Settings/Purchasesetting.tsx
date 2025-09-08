import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Spinner } from '../../constants/Spinner';
import { Modal } from '../../constants/Modal';
import { State } from '../../enums';


// Define the type for your purchase settings
interface PurchaseSettings {
    defaultTaxRate?: number;
    defaultDiscount?: number;
    inputMRP?: boolean;
    zeroValueValidation?: boolean;
    enableBarcodePrinting?: boolean;
    copyVoucherAfterSaving?: boolean;
    voucherName?: string;
    voucherPrefix?: string;
    currentVoucherNumber?: number;
}

const PurchaseSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const [settings, setSettings] = useState<PurchaseSettings>({});
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [modal, setModal] = useState<{ message: string; type: State } | null>(null);

    const settingsDocRef = doc(db, 'settings', 'purchase-settings');

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const docSnap = await getDoc(settingsDocRef);
                if (docSnap.exists()) {
                    setSettings(docSnap.data() as PurchaseSettings);
                } else {
                    // Initialize with default values if the document doesn't exist
                    setSettings({
                        defaultTaxRate: 18,
                        defaultDiscount: 0,
                        inputMRP: true,
                        zeroValueValidation: false,
                        enableBarcodePrinting: true,
                        copyVoucherAfterSaving: false,
                        voucherName: 'Main Purchase',
                        voucherPrefix: 'PRC-',
                        currentVoucherNumber: 0,
                    });
                }
            } catch (err) {
                console.error('Failed to fetch purchase settings:', err);
                setModal({ message: 'Failed to load settings. Please try again.', type: State.ERROR });
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateDoc(settingsDocRef, settings as { [key: string]: any });
            setModal({ message: 'Settings saved successfully!', type: State.SUCCESS });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setModal({ message: 'Failed to save settings. Please try again.', type: State.ERROR });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col min-h-screen items-center justify-center">
                <Spinner />
                <p className="mt-4 text-gray-600">Loading settings...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen bg-white w-full">
            {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}

            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
                <button onClick={() => navigate(-1)} className="text-2xl font-bold text-gray-600 bg-transparent border-none cursor-pointer p-1">&times;</button>
                <div className="w-6"></div>
            </div>

            <main className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto box-border">
                <form onSubmit={handleSave} className="bg-white rounded-lg p-6 shadow-md">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Default Values</h2>

                    {/* Default Tax Rate */}
                    <div className="mb-4">
                        <label htmlFor="tax-rate" className="block text-gray-700 text-sm font-medium mb-1">Default Tax Rate (%)</label>
                        <input
                            type="number"
                            id="tax-rate"
                            value={settings.defaultTaxRate || ''}
                            onChange={(e) => setSettings({ ...settings, defaultTaxRate: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 text-base box-border placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="e.g., 18"
                        />
                    </div>

                    {/* Default Discount */}
                    <div className="mb-4">
                        <label htmlFor="discount" className="block text-gray-700 text-sm font-medium mb-1">Default Discount (%)</label>
                        <input
                            type="number"
                            id="discount"
                            value={settings.defaultDiscount || ''}
                            onChange={(e) => setSettings({ ...settings, defaultDiscount: parseFloat(e.target.value) || 0 })}
                            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 text-base box-border placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="e.g., 0"
                        />
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 my-4 border-t pt-4">Voucher Numbering</h2>

                    {/* Voucher Name */}
                    <div className="mb-4">
                        <label htmlFor="voucher-name" className="block text-gray-700 text-sm font-medium mb-1">Voucher Name</label>
                        <input
                            type="text"
                            id="voucher-name"
                            value={settings.voucherName || ''}
                            onChange={(e) => setSettings({ ...settings, voucherName: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 text-base box-border placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="e.g., Main Purchase"
                        />
                    </div>

                    {/* Voucher Prefix */}
                    <div className="mb-4">
                        <label htmlFor="voucher-prefix" className="block text-gray-700 text-sm font-medium mb-1">Voucher Prefix</label>
                        <input
                            type="text"
                            id="voucher-prefix"
                            value={settings.voucherPrefix || ''}
                            onChange={(e) => setSettings({ ...settings, voucherPrefix: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 text-base box-border placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="e.g., PRC-"
                        />
                    </div>

                    {/* Current Voucher Number */}
                    <div className="mb-4">
                        <label htmlFor="current-number" className="block text-gray-700 text-sm font-medium mb-1">Current Voucher Number</label>
                        <input
                            type="number"
                            id="current-number"
                            value={settings.currentVoucherNumber || 0}
                            onChange={(e) => setSettings({ ...settings, currentVoucherNumber: parseInt(e.target.value) || 0 })}
                            className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-800 text-base box-border placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                            placeholder="e.g., 100"
                        />
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 my-4 border-t pt-4">Transaction Behavior</h2>

                    {/* Checkbox for Input Item MRP */}
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="input-mrp"
                            checked={settings.inputMRP || false}
                            onChange={(e) => setSettings({ ...settings, inputMRP: e.target.checked })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="input-mrp" className="ml-2 text-gray-700 text-sm font-medium">Require MRP Input</label>
                    </div>

                    {/* Checkbox for Zero Value Validation */}
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="zero-value"
                            checked={settings.zeroValueValidation || false}
                            onChange={(e) => setSettings({ ...settings, zeroValueValidation: e.target.checked })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="zero-value" className="ml-2 text-gray-700 text-sm font-medium">Allow Zero Value Purchases</label>
                    </div>

                    {/* Checkbox for Print Barcode After Saving */}
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="print-barcode"
                            checked={settings.enableBarcodePrinting || false}
                            onChange={(e) => setSettings({ ...settings, enableBarcodePrinting: e.target.checked })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="print-barcode" className="ml-2 text-gray-700 text-sm font-medium">Enable Barcode Printing</label>
                    </div>

                    {/* Checkbox for Copy Voucher After Saving */}
                    <div className="flex items-center mb-6">
                        <input
                            type="checkbox"
                            id="copy-voucher"
                            checked={settings.copyVoucherAfterSaving || false}
                            onChange={(e) => setSettings({ ...settings, copyVoucherAfterSaving: e.target.checked })}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="copy-voucher" className="ml-2 text-gray-700 text-sm font-medium">Copy Voucher After Saving</label>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Spinner /> : 'Save Settings'}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default PurchaseSettingsPage;