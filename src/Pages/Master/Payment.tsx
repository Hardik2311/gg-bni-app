import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import type { Item } from '../../constants/models';
import { getFirestoreOperations } from '../../lib/items_firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/ui/card';
import { CustomButton } from '../../Components';
import { Variant } from '../../enums';
import { Input } from '../../Components/ui/input';

// @ts-ignore
import QRious from 'qrious';

type PrintableItem = Item & { quantityToPrint: number };
type PrefilledItem = { id: string, quantity: number, name: string };

const QRCodeGeneratorPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [allItems, setAllItems] = useState<Item[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [printQueue, setPrintQueue] = useState<PrintableItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const printQrCanvasRef = useRef<HTMLCanvasElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const hasPrefilled = useRef(false); // Ref to prevent re-running prefill logic

    const location = useLocation();

    const dbOperations = useMemo(() => {
        if (currentUser?.companyId) {
            return getFirestoreOperations(currentUser.companyId);
        }
        return null;
    }, [currentUser]);

    // Effect to fetch all items once on load
    useEffect(() => {
        if (!dbOperations) {
            setIsLoading(false);
            return;
        }
        const fetchItems = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const fetchedItems = await dbOperations.getItems();
                setAllItems(fetchedItems.filter(item => item.barcode && item.barcode.trim() !== ''));
            } catch (err) {
                console.error("Failed to fetch items:", err);
                setError("Could not load items from the database.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchItems();
    }, [dbOperations]);

    // --- UPDATED useEffect to correctly handle pre-filled items ---
    useEffect(() => {
        const prefilledItems = location.state?.prefilledItems as PrefilledItem[] | undefined;

        // Condition to run: prefilled data exists, all items have been loaded, and we haven't run this logic before.
        if (prefilledItems && allItems.length > 0 && !hasPrefilled.current) {

            // Create a Map for efficient lookup of full item details
            const allItemsMap = new Map(allItems.map(item => [item.id, item]));

            const itemsToPrint = prefilledItems.map((pItem: PrefilledItem) => {
                // Find the full item details using the ID from the prefilled item
                const fullItem = allItemsMap.get(pItem.id);

                if (fullItem) {
                    // Combine the full details with the quantity from the purchase
                    return {
                        ...fullItem,
                        quantityToPrint: pItem.quantity,
                    };
                }
                console.warn(`Item with ID ${pItem.id} (${pItem.name}) not found in available items.`);
                return null;
            }).filter((item): item is PrintableItem => item !== null); // Filter out any nulls

            setPrintQueue(itemsToPrint);
            hasPrefilled.current = true; // Mark as prefilled to prevent re-running
        }
    }, [location.state, allItems]); // Depend on allItems to ensure it's loaded

    const searchResults = useMemo(() => {
        if (!searchTerm.trim()) {
            return [];
        }
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const itemIdsInQueue = new Set(printQueue.map(item => item.id));
        return allItems.filter(item =>
            !itemIdsInQueue.has(item.id) &&
            (item.name.toLowerCase().includes(lowerCaseSearchTerm) ||
                item.barcode?.toLowerCase().includes(lowerCaseSearchTerm))
        );
    }, [searchTerm, allItems, printQueue]);

    const handleAddItemToQueue = useCallback((item: Item) => {
        if (printQueue.some(queuedItem => queuedItem.id === item.id)) {
            return;
        }
        setPrintQueue(prev => [...prev, { ...item, quantityToPrint: 1 }]);
        setSearchTerm('');
        searchInputRef.current?.focus();
    }, [printQueue]);

    const handleRemoveItemFromQueue = useCallback((itemId: string) => {
        setPrintQueue(prev => prev.filter(item => item.id !== itemId));
    }, []);

    const handleQuantityChange = useCallback((itemId: string, quantity: number) => {
        setPrintQueue(prev => prev.map(item =>
            item.id === itemId
                ? { ...item, quantityToPrint: Math.max(1, quantity) }
                : item
        ));
    }, []);

    const isPrintButtonDisabled = printQueue.length === 0;

    const handlePrint = useCallback(async () => {
        if (isPrintButtonDisabled || !dbOperations || !printQrCanvasRef.current) return;

        try {
            const businessInfo = await dbOperations.getBusinessInfo();
            const companyName = businessInfo.name || 'Your Company';
            const businessAddress = businessInfo.address || 'Your Address';
            const businessPhoneNumber = businessInfo.phoneNumber || 'Your Phone Number';

            const printWindow = window.open('', '', 'height=600,width=800');
            if (!printWindow) {
                alert("Could not open print window. Please allow pop-ups.");
                return;
            }

            printWindow.document.write('<html><head><title>Print QR Code Labels</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
                @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
                body { margin: 0; font-family: 'Roboto', sans-serif; display: flex; flex-wrap: wrap; justify-content: flex-start; align-content: flex-start; }
                .label-container { width: 35mm; height: 35mm; border: 0.5px dotted #ccc; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: space-around; padding: 1mm; page-break-inside: avoid; text-align: center; overflow: hidden; }
                .company-name { font-size: 7pt; font-weight: bold; margin: 0; line-height: 1; }
                .qr-image { width: 18mm; height: 18mm; object-fit: contain; }
                .item-barcode { font-size: 6pt; margin: 0; line-height: 1; }
                .item-name { font-size: 5pt; font-weight: bold; margin: 0; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
                .item-mrp { font-size: 7pt; font-weight: bold; margin: 0; line-height: 1; }
                .business-info { font-size: 3pt; margin: 0; line-height: 1; display: grid; }
                .business-address { font-size: 3pt; margin: 0; line-height: 1; }
                .ownernumber { font-size: 3pt; margin: 0; line-height: 1; }
                @page { margin: 2mm; }
            `);
            printWindow.document.write('</style></head><body>');

            for (const item of printQueue) {
                if (!item.barcode) {
                    console.warn(`Item '${item.name}' skipped because it has no barcode.`);
                    continue;
                }
                new QRious({
                    element: printQrCanvasRef.current,
                    value: item.barcode,
                    size: 100,
                    padding: 6,
                });
                const qrDataUrl = printQrCanvasRef.current.toDataURL('image/png');
                for (let i = 0; i < item.quantityToPrint; i++) {
                    printWindow.document.write(`
                        <div class="label-container">
                            <p class="company-name">${companyName}</p>
                            <div class="business-info"><p class="business-address">${businessAddress}</p><p class="ownernumber">${businessPhoneNumber}</p></div>
                            <img class="qr-image" src="${qrDataUrl}" alt="QR Code" />
                            <p class="item-barcode">${item.barcode}</p>
                            <p class="item-name">${item.name}</p>
                            <p class="item-mrp">MRP: ${item.mrp}</p>
                        </div>
                    `);
                }
            }

            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 500);

        } catch (err) {
            console.error("Failed to print labels:", err);
            alert("Could not print labels. Failed to fetch business information or generate QR codes.");
        }
    }, [printQueue, isPrintButtonDisabled, dbOperations]);

    const renderContent = () => {
        if (isLoading) return <p className="text-center text-gray-500">Loading items...</p>;
        if (error) return <p className="text-center text-red-500">{error}</p>;

        return (
            <div className="flex flex-col gap-4">
                <div className="relative">
                    <Input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search to add items to the print list..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {searchResults.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleAddItemToQueue(item)}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {printQueue.length > 0 && <h3 className="text-lg font-semibold text-gray-700">Cart</h3>}

                <div className="flex flex-col gap-1">
                    {printQueue.length === 0 && searchTerm.length === 0 && (
                        <p className="text-center text-gray-500 py-8">Select items to print</p>
                    )}
                    {printQueue.map((item) => (
                        <div key={item.id} className="p-3 border rounded-lg bg-white shadow-sm flex flex-col gap-1">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col text-sm text-gray-800 overflow-hidden pr-2">
                                    <span className="font-semibold text-base">{item.name}</span>
                                </div>
                                <button onClick={() => handleRemoveItemFromQueue(item.id!)} className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0" aria-label={`Remove ${item.name}`}>
                                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600 font-medium">₹{item.mrp}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-500">Qty</span>
                                    <div className="flex items-center border border-gray-300 rounded-md">
                                        <button onClick={() => handleQuantityChange(item.id!, item.quantityToPrint - 1)} className="px-3 py-1 text-xl font-bold text-gray-600 hover:bg-gray-100 rounded-l-md">-</button>
                                        <Input
                                            type="number"
                                            value={item.quantityToPrint}
                                            onChange={(e) => handleQuantityChange(item.id!, Number(e.target.value))}
                                            className="w-16 h-8 text-center border-l border-r rounded-none p-0 focus:ring-0"
                                        />
                                        <button onClick={() => handleQuantityChange(item.id!, item.quantityToPrint + 1)} className="px-3 py-1 text-xl font-bold text-gray-600 hover:bg-gray-100 rounded-r-md">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <canvas ref={printQrCanvasRef} style={{ display: 'none' }}></canvas>

                {printQueue.length > 0 && (
                    <div className="border-t pt-4">
                        <CustomButton onClick={handlePrint} disabled={isPrintButtonDisabled} variant={Variant.Filled} className="w-full py-3">
                            Print Labels for {printQueue.length} Items
                        </CustomButton>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div >
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl text-center font-bold text-gray-800">Item QR Code Print</CardTitle>
                </CardHeader>
                <CardContent>{renderContent()}</CardContent>
            </Card>
        </div>
    );
};

export default QRCodeGeneratorPage;