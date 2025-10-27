import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore'; // Import needed functions
import { Spinner } from '../../constants/Spinner';
import { Modal } from '../../constants/Modal';
import { State } from '../../enums';
import { useAuth } from '../../context/auth-context';


export interface SalesSettings {
    settingType: 'sales';
    salesViewType?: 'card' | 'list';
    enableSalesmanSelection?: boolean;

    enableTax?: boolean;
    taxType?: 'inclusive' | 'exclusive';
    defaultTaxRate?: number;
    enableRounding?: boolean;
    enforceExactMRP?: boolean;

    enableItemWiseDiscount?: boolean;
    lockDiscountEntry?: boolean;
    lockSalePriceEntry?: boolean;
    defaultDiscount?: number;

    allowNegativeStock?: boolean;
    allowDueBilling?: boolean;

    requireCustomerName?: boolean;
    requireCustomerMobile?: boolean;

    voucherName?: string;
    voucherPrefix?: string;
    currentVoucherNumber?: number;
    copyVoucherAfterSaving?: boolean;
    companyId?: string;
}

const SalesSettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [settings, setSettings] = useState<SalesSettings>({ settingType: 'sales' });
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [modal, setModal] = useState<{ message: string; type: State } | null>(null);

    const [settingsDocId, setSettingsDocId] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser?.companyId) {
            if (!isLoading) setIsLoading(true);
            return;
        }

        const companyId = currentUser.companyId;

        const fetchOrCreateSettings = async () => {
            setIsLoading(true);
            const settingsCollectionRef = collection(db, 'settings');

            const q = query(
                settingsCollectionRef,
                where('companyId', '==', companyId),
                where('settingType', '==', 'sales')
            );

            try {
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const docSnap = querySnapshot.docs[0];
                    setSettings(docSnap.data() as SalesSettings);
                    setSettingsDocId(docSnap.id);
                } else {
                    console.warn(`No 'sales' settings found for company ${companyId}. Creating defaults.`);
                    const defaultSettings: SalesSettings = {
                        settingType: 'sales',
                        salesViewType: 'list',
                        enableSalesmanSelection: true,
                        enableTax: true,
                        taxType: 'exclusive',
                        defaultTaxRate: 0,
                        enableRounding: true,
                        enforceExactMRP: false,
                        enableItemWiseDiscount: true,
                        lockDiscountEntry: false,
                        lockSalePriceEntry: false,
                        defaultDiscount: 0,
                        allowNegativeStock: false,
                        allowDueBilling: true,
                        requireCustomerName: true,
                        requireCustomerMobile: false,
                        voucherName: 'Sales',
                        voucherPrefix: 'SLS-',
                        currentVoucherNumber: 1,
                        copyVoucherAfterSaving: false,
                        companyId: companyId,
                    };

                    const newDocRef = await addDoc(settingsCollectionRef, defaultSettings);
                    setSettings(defaultSettings);
                    setSettingsDocId(newDocRef.id);
                }
            } catch (err) {
                console.error('Failed to fetch/create sales settings:', err);
                setModal({ message: 'Failed to load settings. Please try again.', type: State.ERROR });
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrCreateSettings();
    }, [currentUser?.companyId]);


    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!settingsDocId) {
            setModal({ message: 'Error: Cannot find settings document ID.', type: State.ERROR });
            return;
        }

        setIsSaving(true);
        try {
            const docToUpdateRef = doc(db, 'settings', settingsDocId);

            const settingsToSave = {
                ...settings,
                companyId: currentUser?.companyId,
                settingType: 'sales'
            };

            await updateDoc(docToUpdateRef, settingsToSave as { [key: string]: any });
            setModal({ message: 'Settings saved successfully!', type: State.SUCCESS });
        } catch (err) {
            console.error('Failed to save settings:', err);
            setModal({ message: 'Failed to save settings. Please try again.', type: State.ERROR });
        } finally {
            setIsSaving(false);
        }
    };


    const handleChange = (field: keyof SalesSettings, value: any) => {
        if (field === 'defaultTaxRate' || field === 'defaultDiscount' || field === 'currentVoucherNumber') {
            const numValue = parseFloat(value);
            setSettings(prev => ({ ...prev, [field]: isNaN(numValue) ? 0 : numValue }));
        } else {
            setSettings(prev => ({ ...prev, [field]: value }));
        }
    };

    const handleCheckboxChange = (field: keyof SalesSettings, checked: boolean) => {
        setSettings(prev => {
            const newSettings = { ...prev, [field]: checked };
            return newSettings;
        });
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
                <h1 className="text-lg font-semibold text-gray-800">Sales Settings</h1>
                <div className="w-6"></div>
            </div>

            <main className="flex-grow p-4 bg-gray-50 w-full overflow-y-auto box-border">
                <form onSubmit={handleSave} className="bg-white rounded-lg p-6 shadow-md max-w-3xl mx-auto">

                    <h2 className="text-lg font-semibold text-gray-800 mb-4">General Settings</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="sales-view-type" className="block text-gray-700 text-sm font-medium mb-1">Sales View Type</label>
                            <select
                                id="sales-view-type"
                                value={settings.salesViewType || 'list'}
                                onChange={(e) => handleChange('salesViewType', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                            >
                                <option value="list">List View</option>
                                <option value="card">Card View</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="salesman-billing" checked={settings.enableSalesmanSelection ?? false} onChange={(e) => handleCheckboxChange('enableSalesmanSelection', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="salesman-billing" className="ml-2 text-gray-700 text-sm font-medium">Enable Salesman-wise Billing</label>
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 my-4 border-t pt-4">Pricing & Tax</h2>
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="enable-tax"
                            checked={settings.enableTax ?? false}
                            onChange={(e) => handleCheckboxChange('enableTax', e.target.checked)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="enable-tax" className="ml-2 text-gray-700 text-sm font-medium">Enable Tax Calculation</label>
                    </div>
                    {settings.enableTax && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label htmlFor="tax-type" className="block text-gray-700 text-sm font-medium mb-1">Tax Calculation</label>
                                <select
                                    id="tax-type"
                                    value={settings.taxType || 'exclusive'}
                                    onChange={(e) => handleChange('taxType', e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                                >
                                    <option value="exclusive">Tax Exclusive (GST extra)</option>
                                    <option value="inclusive">Tax Inclusive (MRP includes GST)</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="tax-rate" className="block text-gray-700 text-sm font-medium mb-1">Default Tax Rate (%)</label>
                                <input
                                    type="number"
                                    id="tax-rate"
                                    value={settings.defaultTaxRate ?? 0}
                                    onChange={(e) => handleChange('defaultTaxRate', e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-lg"
                                    placeholder="e.g., 5"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    )}
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="enable-rounding" checked={settings.enableRounding ?? false} onChange={(e) => handleCheckboxChange('enableRounding', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="enable-rounding" className="ml-2 text-gray-700 text-sm font-medium">Enable Rounding Off</label>
                    </div>
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="enforce-mrp" checked={settings.enforceExactMRP ?? false} onChange={(e) => handleCheckboxChange('enforceExactMRP', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="enforce-mrp" className="ml-2 text-gray-700 text-sm font-medium">Enforce Selling Price == MRP</label>
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 my-4 border-t pt-4">Discounts & Price Control</h2>

                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="item-discount" checked={settings.enableItemWiseDiscount ?? false} onChange={(e) => handleCheckboxChange('enableItemWiseDiscount', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="item-discount" className="ml-2 text-gray-700 text-sm font-medium">Enable Item-wise Discount</label>
                    </div>


                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="lock-discount" checked={settings.lockDiscountEntry ?? false} onChange={(e) => handleCheckboxChange('lockDiscountEntry', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="lock-discount" className="ml-2 text-gray-700 text-sm font-medium">Lock Discount Entry (Prevent editing on sales screen)</label>
                    </div>
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="lock-price" checked={settings.lockSalePriceEntry ?? false} onChange={(e) => handleCheckboxChange('lockSalePriceEntry', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="lock-price" className="ml-2 text-gray-700 text-sm font-medium">Lock Sale Price (Prevent editing on sales screen)</label>
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 my-4 border-t pt-4">Billing & Inventory Rules</h2>
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="allow-negative" checked={settings.allowNegativeStock ?? false} onChange={(e) => handleCheckboxChange('allowNegativeStock', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="allow-negative" className="ml-2 text-gray-700 text-sm font-medium">Allow Negative Inventory Billing</label>
                    </div>
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="allow-due" checked={settings.allowDueBilling ?? false} onChange={(e) => handleCheckboxChange('allowDueBilling', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="allow-due" className="ml-2 text-gray-700 text-sm font-medium">Allow Due Billing (Credit Sales)</label>
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 my-4 border-t pt-4">Required Fields</h2>
                    <p className="text-sm text-gray-500 mb-2">Select fields that must be filled before saving a sale.</p>
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="req-customer" checked={settings.requireCustomerName ?? false} onChange={(e) => handleCheckboxChange('requireCustomerName', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="req-customer" className="ml-2 text-gray-700 text-sm font-medium">Require Customer Name</label>
                    </div>
                    <div className="flex items-center mb-4">
                        <input type="checkbox" id="req-mobile" checked={settings.requireCustomerMobile ?? false} onChange={(e) => handleCheckboxChange('requireCustomerMobile', e.target.checked)} className="w-4 h-4 text-blue-600" />
                        <label htmlFor="req-mobile" className="ml-2 text-gray-700 text-sm font-medium">Require Customer Mobile</label>
                    </div>

                    <h2 className="text-lg font-semibold text-gray-800 my-4 border-t pt-4">Voucher Numbering & Options</h2>
                    <div className="flex items-center mb-4">
                        <input
                            type="checkbox"
                            id="copy-voucher"
                            checked={settings.copyVoucherAfterSaving ?? false}
                            onChange={(e) => handleCheckboxChange('copyVoucherAfterSaving', e.target.checked)}
                            className="w-4 h-4 text-blue-600"
                        />
                        <label htmlFor="copy-voucher" className="ml-2 text-gray-700 text-sm font-medium">Keep items in cart after saving (Copy Voucher)</label>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label htmlFor="voucher-name" className="block text-gray-700 text-sm font-medium mb-1">Voucher Name</label>
                            <input
                                type="text"
                                id="voucher-name"
                                value={settings.voucherName || ''}
                                onChange={(e) => handleChange('voucherName', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg"
                                placeholder="e.g., Sales"
                            />
                        </div>
                        <div>
                            <label htmlFor="voucher-prefix" className="block text-gray-700 text-sm font-medium mb-1">Voucher Prefix</label>
                            <input
                                type="text"
                                id="voucher-prefix"
                                value={settings.voucherPrefix || ''}
                                onChange={(e) => handleChange('voucherPrefix', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg"
                                placeholder="e.g., SLS-"
                            />
                        </div>
                        <div>
                            <label htmlFor="current-number" className="block text-gray-700 text-sm font-medium mb-1">Next Voucher Number</label>
                            <input
                                type="number"
                                id="current-number"
                                value={settings.currentVoucherNumber ?? 1}
                                onChange={(e) => handleChange('currentVoucherNumber', e.target.value)}
                                className="w-full p-3 border border-gray-300 rounded-lg"
                                placeholder="e.g., 1"
                                min="1"
                                step="1"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSaving || isLoading}
                        className="w-full mt-8 flex items-center justify-center bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        {isSaving ? <Spinner /> : 'Save Settings'}
                    </button>
                </form>
            </main>
        </div>
    );
};

export default SalesSettingsPage;

