import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import type { Item } from '../../constants/models';
import { getFirestoreOperations } from '../../lib/items_firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/ui/card';
import { CustomButton } from '../../Components';
import { Variant } from '../../enums';
import { Input } from '../../Components/ui/input';
import { render, Printer, Text, QRCode, Br } from 'react-thermal-printer';

// Helper types
type PrintableItem = Item & { quantityToPrint: number };
type PrefilledItem = { id: string, quantity: number, name: string };

const QRCodeGeneratorPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [allItems, setAllItems] = useState<Item[]>([]);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [printQueue, setPrintQueue] = useState<PrintableItem[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [isPrinting, setIsPrinting] = useState(false);

    const searchInputRef = useRef<HTMLInputElement>(null);
    const hasPrefilled = useRef(false);
    const location = useLocation();

    const dbOperations = useMemo(() => {
        if (currentUser?.companyId) {
            return getFirestoreOperations(currentUser.companyId);
        }
        return null;
    }, [currentUser]);

    // Effect to fetch all items
    useEffect(() => {
        if (!dbOperations) {
            setIsLoading(false); return;
        }
        const fetchItems = async () => {
            setIsLoading(true); setError(null);
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

    // Effect to handle pre-filled items
    useEffect(() => {
        const prefilledItems = location.state?.prefilledItems as PrefilledItem[] | undefined;
        if (prefilledItems && allItems.length > 0 && !hasPrefilled.current) {
            const allItemsMap = new Map(allItems.map(item => [item.id, item]));
            const itemsToPrint = prefilledItems.map((pItem: PrefilledItem) => {
                const fullItem = allItemsMap.get(pItem.id);
                if (fullItem) {
                    return { ...fullItem, quantityToPrint: pItem.quantity };
                }
                return null;
            }).filter((item): item is PrintableItem => item !== null);
            setPrintQueue(itemsToPrint);
            hasPrefilled.current = true;
        }
    }, [location.state, allItems]);

    const searchResults = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const itemIdsInQueue = new Set(printQueue.map(item => item.id));
        return allItems.filter(item => !itemIdsInQueue.has(item.id) && (item.name.toLowerCase().includes(lowerCaseSearchTerm) || item.barcode?.toLowerCase().includes(lowerCaseSearchTerm)));
    }, [searchTerm, allItems, printQueue]);

    const handleAddItemToQueue = useCallback((item: Item) => {
        if (printQueue.some(queuedItem => queuedItem.id === item.id)) return;
        setPrintQueue(prev => [...prev, { ...item, quantityToPrint: 1 }]);
        setSearchTerm('');
        searchInputRef.current?.focus();
    }, [printQueue]);

    const handleRemoveItemFromQueue = useCallback((itemId: string) => {
        setPrintQueue(prev => prev.filter(item => item.id !== itemId));
    }, []);

    const handleQuantityChange = useCallback((itemId: string, quantity: number) => {
        setPrintQueue(prev => prev.map(item =>
            item.id === itemId ? { ...item, quantityToPrint: Math.max(1, quantity) } : item
        ));
    }, []);

    const isPrintButtonDisabled = printQueue.length === 0 || isPrinting;

    const handlePrint = useCallback(async () => {
        if (isPrintButtonDisabled || !dbOperations) return;

        setIsPrinting(true);
        setError(null);

        try {
            const businessInfo = await dbOperations.getBusinessInfo();
            const companyName = businessInfo.name || 'Your Company';

            const port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate: 9600 });
            const writer = port.writable.getWriter();

            for (const item of printQueue) {
                if (!item.barcode) continue;

                for (let i = 0; i < item.quantityToPrint; i++) {

                    const labelComponent = (
                        <Printer type="epson" width={48}>
                            <Text align="center" bold={true}>{companyName}</Text>
                            <Br />
                            {/* @ts-ignore */}
                            <QRCode align="center" cellSize={5} value={item.barcode} />
                            <Text align="center" size={{ width: 1, height: 1 }}>{item.barcode}</Text>
                            <Text align="center">{item.name}</Text>
                            <Text align="center" bold={true}>{`MRP: ₹${item.mrp}`}</Text>
                        </Printer>
                    );

                    const data = await render(labelComponent);
                    await writer.write(data);
                }
            }

            writer.releaseLock();
            await port.close();

            alert("All labels sent to printer!");

        } catch (err: any) {
            console.error("Printing failed:", err);

            // --- UPDATED: More specific error handling ---
            if (err.code === 'permission-denied') {
                setError('Database Error: You do not have permission to read business information. Please check Firestore rules.');
            } else {
                setError(`Printing failed: ${err.message}. Please ensure the printer is connected and permission was granted.`);
            }

        } finally {
            setIsPrinting(false);
        }
    }, [printQueue, isPrintButtonDisabled, dbOperations]);

    const renderContent = () => {
        if (isLoading) return <p className="text-center text-gray-500">Loading items...</p>;

        return (
            <div className="flex flex-col gap-4">
                {error && <p className="p-3 bg-red-100 text-red-700 rounded-md text-center">{error}</p>}

                <div className="relative">
                    <Input ref={searchInputRef} type="text" placeholder="Search to add items..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pr-4 py-2 border rounded-lg" />
                    {searchResults.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            {searchResults.map(item => (<button key={item.id} onClick={() => handleAddItemToQueue(item)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{item.name}</button>))}
                        </div>
                    )}
                </div>

                {printQueue.length > 0 && <h3 className="text-lg font-semibold text-gray-700">Cart</h3>}

                <div className="flex flex-col gap-3">
                    {printQueue.length === 0 && searchTerm.length === 0 && (<p className="text-center text-gray-500 py-8">Your cart is empty</p>)}
                    {printQueue.map((item) => (
                        <div key={item.id} className="p-3 border rounded-lg bg-white shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div className="flex flex-col text-sm text-gray-800 overflow-hidden pr-2"><span className="font-semibold text-base">{item.name}</span></div>
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
                                        <Input type="number" value={item.quantityToPrint} onChange={(e) => handleQuantityChange(item.id!, Number(e.target.value))} className="w-16 h-8 text-center border-l border-r rounded-none p-0 focus:ring-0" />
                                        <button onClick={() => handleQuantityChange(item.id!, item.quantityToPrint + 1)} className="px-3 py-1 text-xl font-bold text-gray-600 hover:bg-gray-100 rounded-r-md">+</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {printQueue.length > 0 && (
                    <div className="border-t pt-4">
                        <CustomButton onClick={handlePrint} disabled={isPrintButtonDisabled} variant={Variant.Filled} className="w-full py-3">
                            {isPrinting ? 'Printing...' : `Print Labels for ${printQueue.length} Items`}
                        </CustomButton>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div>
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl text-center font-bold text-gray-800">Item QR Code Generator</CardTitle>
                </CardHeader>
                <CardContent>{renderContent()}</CardContent>
            </Card>
        </div>
    );
};

export default QRCodeGeneratorPage;