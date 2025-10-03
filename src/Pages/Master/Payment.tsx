import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../context/auth-context';
import type { Item } from '../../constants/models';
import { getFirestoreOperations } from '../../lib/items_firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../../Components/ui/card';
import { CustomButton } from '../../Components';
import { Variant } from '../../enums';

// @ts-ignore
import QRious from 'qrious';

const QRCodeGeneratorPage: React.FC = () => {
    const { currentUser } = useAuth();
    const [itemsWithBarcode, setItemsWithBarcode] = useState<Item[]>([]);
    const [selectedItemId, setSelectedItemId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement>(null); // For display on the page
    const printQrCanvasRef = useRef<HTMLCanvasElement>(null); // For generating print-specific QR code
    const [qrLabelQuantity, setQrLabelQuantity] = useState<number>(1); // New state for label quantity

    const dbOperations = useMemo(() => {
        if (currentUser?.companyId) {
            return getFirestoreOperations(currentUser.companyId);
        }
        return null;
    }, [currentUser]);

    useEffect(() => {
        if (!dbOperations) {
            setIsLoading(false);
            return;
        }

        const fetchItems = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const allItems = await dbOperations.getItems();
                const filteredItems = allItems.filter(item => item.barcode && item.barcode.trim() !== '');
                setItemsWithBarcode(filteredItems);
                if (filteredItems.length > 0) {
                    setSelectedItemId(filteredItems[0].id!);
                }
            } catch (err) {
                console.error("Failed to fetch items:", err);
                setError("Could not load items from the database.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchItems();
    }, [dbOperations]);

    const selectedItem = useMemo(() => {
        return itemsWithBarcode.find(item => item.id === selectedItemId);
    }, [selectedItemId, itemsWithBarcode]);

    // Generate QR code for page display
    useEffect(() => {
        if (qrCanvasRef.current && selectedItem?.barcode) {
            new QRious({
                element: qrCanvasRef.current,
                value: selectedItem.barcode,
                size: 256, // Larger for on-page display
                padding: 16,
                foreground: 'black',
                background: 'white',
            });
        }
    }, [selectedItem]);

    const handleDownload = useCallback(() => {
        if (!qrCanvasRef.current || !selectedItem) return;
        const link = document.createElement('a');
        link.download = `qrcode-${selectedItem.name.replace(/\s+/g, '_')}.png`;
        link.href = qrCanvasRef.current.toDataURL('image/png');
        link.click();
    }, [selectedItem]);

    const handlePrint = useCallback(() => {
        if (!selectedItem || !printQrCanvasRef.current) return;

        // Generate a smaller QR code specifically for printing
        new QRious({
            element: printQrCanvasRef.current,
            value: selectedItem.barcode,
            size: 100, // Smaller size for 35mm labels
            padding: 8,
            foreground: 'black',
            background: 'white',
        });
        const qrDataUrl = printQrCanvasRef.current.toDataURL('image/png');

        const printWindow = window.open('', '', 'height=600,width=800');

        if (printWindow) {
            printWindow.document.write('<html><head><title>Print QR Codes</title>');
            printWindow.document.write('<style>');
            printWindow.document.write(`
        body { margin: 0; font-family: sans-serif; display: flex; flex-wrap: wrap; justify-content: flex-start; align-content: flex-start; }
        .label-container {
          width: 35mm; /* Approximate width of label */
          height: 35mm; /* Approximate height of label */
          border: 0.5px solid #ccc; /* For visual separation during testing, remove for final print */
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2mm; /* Inner padding for the label content */
          page-break-inside: avoid; /* Prevent labels from splitting across pages */
          text-align: center;
          overflow: hidden; /* Ensure content stays within bounds */
        }
        .qr-image {
          width: 25mm; /* Adjust QR image size to fit inside the label with text */
          height: 25mm;
          object-fit: contain;
          margin-bottom: 1mm;
        }
        .item-name {
          font-size: 8pt; /* Smaller font for item name */
          font-weight: bold;
          margin: 0;
          line-height: 1;
          white-space: nowrap; /* Prevent line breaks for short names */
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 100%; /* Ensure name fits */
        }
        .item-barcode {
          font-size: 7pt; /* Even smaller for barcode */
          margin: 0;
          line-height: 1;
        }
        @page {
          margin: 5mm; /* Reduce page margins to maximize label space */
        }
      `);
            printWindow.document.write('</style>');
            printWindow.document.write('</head><body>');

            for (let i = 0; i < qrLabelQuantity; i++) {
                printWindow.document.write(`
          <div class="label-container">
            <img class="qr-image" src="${qrDataUrl}" alt="QR Code" />
            <p class="item-name">${selectedItem.name}</p>
            <p class="item-barcode">${selectedItem.barcode}</p>
          </div>
        `);
            }

            printWindow.document.write('</body></html>');
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
        }
    }, [selectedItem, qrLabelQuantity]);

    const renderContent = () => {
        if (isLoading) {
            return <p className="text-center text-gray-500">Loading items...</p>;
        }
        if (error) {
            return <p className="text-center text-red-500">{error}</p>;
        }
        if (itemsWithBarcode.length === 0) {
            return <p className="text-center text-gray-500">No items with barcodes found in your inventory.</p>;
        }

        return (
            <div className="flex flex-col items-center gap-6">
                <div className="w-full max-w-md">
                    <label htmlFor="item-select" className="block text-sm font-medium text-gray-700 mb-1">
                        Select an Item
                    </label>
                    <select
                        id="item-select"
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(e.target.value)}
                        className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    >
                        {itemsWithBarcode.map((item) => (
                            <option key={item.id} value={item.id!}>
                                {item.name}
                            </option>
                        ))}
                    </select>
                </div>

                {selectedItem && (
                    <>
                        <div className="p-6 border rounded-lg bg-white shadow-lg flex flex-col items-center">
                            {/* This canvas is for display on the page */}
                            <canvas ref={qrCanvasRef} className="w-64 h-64 mb-4"></canvas>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-800">{selectedItem.name}</h3>
                                <p className="text-sm text-left text-black-500">MRP: {selectedItem.mrp}</p>
                                <p className="text-sm text-gray-500">Barcode: {selectedItem.barcode}</p>
                            </div>
                        </div>

                        {/* Hidden canvas for generating print QR code at a specific size */}
                        <canvas ref={printQrCanvasRef} style={{ display: 'none' }}></canvas>

                        <div className="w-full max-w-md flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                                <label htmlFor="qr-quantity" className="text-sm font-medium text-gray-700 whitespace-nowrap">
                                    Number of Labels:
                                </label>
                                <input
                                    type="number"
                                    id="qr-quantity"
                                    value={qrLabelQuantity}
                                    onChange={(e) => setQrLabelQuantity(Math.max(1, Number(e.target.value)))}
                                    min="1"
                                    className="flex-grow p-2 border border-gray-300 rounded-lg shadow-sm text-center"
                                />
                            </div>
                            <div className="flex gap-4">
                                <CustomButton onClick={handleDownload} disabled={!selectedItem} variant={Variant.Outline} className="flex-grow py-3">
                                    Download QR
                                </CustomButton>
                                <CustomButton onClick={handlePrint} disabled={!selectedItem || qrLabelQuantity < 1} variant={Variant.Filled} className="flex-grow py-3">
                                    Print Labels
                                </CustomButton>
                            </div>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="text-2xl text-center font-bold text-gray-800">
                        Item QR Code Generator
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
            </Card>
        </div>
    );
};

export default QRCodeGeneratorPage;