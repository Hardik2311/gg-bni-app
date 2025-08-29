// src/components/BarcodeScanner.tsx

import React, { useEffect, useRef } from 'react';
// ✅ 1. Import the necessary format enums
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface BarcodeScannerProps {
    isOpen: boolean;
    onClose: () => void;
    onScanSuccess: (decodedText: string) => void;
    qrboxSize?: number;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
    isOpen,
    onClose,
    onScanSuccess,
    qrboxSize = 250
}) => {
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const scannerContainerId = 'barcode-scanner-container';

    useEffect(() => {
        if (isOpen) {
            if (!scannerRef.current) {
                // ✅ 2. Configure the scanner to support multiple formats
                const config = {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.QR_CODE,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                    ],
                };
                // The second argument to the constructor is the verbose flag or a full config object.
                // We need to pass the verbose flag as part of the config.
                scannerRef.current = new Html5Qrcode(scannerContainerId, { verbose: false, ...config });
            }

            const scanner = scannerRef.current;

            const startScanner = async () => {
                try {
                    await scanner.start(
                        { facingMode: "environment" },
                        {
                            fps: 10,
                            qrbox: { width: qrboxSize, height: qrboxSize }
                        },
                        (decodedText) => {
                            onScanSuccess(decodedText);
                        },
                        undefined
                    );
                } catch (err) {
                    console.error("Error starting barcode scanner:", err);
                }
            };

            startScanner();
        }

        return () => {
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop()
                    .catch((err) => {
                        console.error("Failed to stop scanner cleanly:", err);
                    });
            }
        };
    }, [isOpen, onScanSuccess, qrboxSize]);

    if (!isOpen) {
        return null;
    }

    return (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center p-4">
            <div id={scannerContainerId} className="w-full max-w-md bg-gray-900 rounded-lg overflow-hidden"></div>
            <button
                onClick={onClose}
                className="mt-4 bg-white text-gray-800 font-bold py-2 px-6 rounded-lg shadow-lg hover:bg-gray-200 transition"
            >
                Close Scanner
            </button>
        </div>
    );
};

export default BarcodeScanner;
