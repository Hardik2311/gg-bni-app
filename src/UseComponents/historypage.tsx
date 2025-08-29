import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { ROUTES } from '../constants/routes.constants';
import { generatePdf } from './pdfGenerator';
import { getItems } from '../lib/items_firebase';

const Spinner: React.FC<{ size?: string }> = ({ size = 'h-5 w-5' }) => (
    <svg className={`animate-spin text-white ${size}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);

const Modal: React.FC<{ message: string; onClose: () => void; type: 'success' | 'error' | 'info'; }> = ({ message, onClose, type }) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
            <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${type === 'success' ? 'bg-green-100' : type === 'error' ? 'bg-red-100' : 'bg-blue-100'}`}>
                {type === 'success' && <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
                {type === 'error' && <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>}
                {type === 'info' && <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>
            <p className="text-lg font-medium text-gray-800 mb-4">{message}</p>
            <button onClick={onClose} className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">OK</button>
        </div>
    </div>
);

const SalesHistoryPage: React.FC = () => {
    const navigate = useNavigate();
    const [sales, setSales] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [modal, setModal] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
    const [pdfGenerating, setPdfGenerating] = useState<string | null>(null);

    useEffect(() => {
        const fetchSales = async () => {
            setIsLoading(true);
            try {
                const salesCol = collection(db, 'sales');
                const salesSnapshot = await getDocs(query(salesCol));
                const salesList = salesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate()
                }));
                setSales(salesList);
            } catch (err) {
                console.error("Error fetching sales history:", err);
                setError('Failed to load sales history.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchSales();
    }, []);

    const handleDownloadPdf = async (sale: any) => {
        setPdfGenerating(sale.id);

        try {
            const fetchedItems = await getItems();
            const populatedItems = sale.items.map((item: any, index: number) => {
                const fullItem = fetchedItems.find((fi: any) => fi.id === item.id);
                return {
                    sno: index + 1,
                    name: item.name,
                    hsn: fullItem?.hsnSac,
                    quantity: item.quantity,
                    unit: fullItem?.unit,
                    listPrice: item.mrp,
                    gstPercent: fullItem?.gst,
                    discountAmount: item.discount,
                };
            });

            const dataForPdf = {
                companyName: "Giftinguru.com",
                companyAddress: "Shop no. 59, Gaur Siddhartham, Siddharth Vihar, Ghaziabad - 201009",
                companyContact: "+91 9625796622",
                companyEmail: "giftingurusiddharthvihar@gmail.com",
                billTo: {
                    name: sale.partyName,
                    address: "420, Kavya enclave, Indraprost, New Delhi - 443567",
                    phone: sale.partyNumber,
                },
                invoice: {
                    number: sale.voucherId,
                    date: sale.createdAt ? sale.createdAt.toLocaleDateString() : new Date().toLocaleDateString(),
                    billedBy: "Bhavesh Agrawal",
                },
                items: populatedItems,
                paymentInfo: {
                    account: "1234234534561",
                    accountName: "Bhavesh Agrawal",
                    bankDetails: "HDFC",
                    gstin: "09ABHR1644A1ZJ",
                },
                terms: "This is a computer-generated invoice. Terms and conditions apply.",
            };

            generatePdf(dataForPdf);

        } catch (err) {
            console.error("Failed to generate PDF:", err);
            setModal({ message: "Failed to generate PDF. Please try again.", type: 'error' });
        } finally {
            setPdfGenerating(null);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-white w-full">
            {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}

            <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
                <button onClick={() => navigate(ROUTES.HOME)} className="text-2xl font-bold text-gray-600 bg-transparent border-none cursor-pointer p-1">&times;</button>
                <h1 className="text-xl font-bold text-gray-800">Sales History</h1>
                <div className="w-6"></div>
            </div>

            <main className="flex-grow p-4 bg-gray-50 overflow-y-auto">
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {isLoading ? (
                        <div className="p-6 text-center text-gray-500">
                            <Spinner size="h-8 w-8 text-gray-500" />
                            <p className="mt-2">Loading sales history...</p>
                        </div>
                    ) : error ? (
                        <div className="p-6 text-center text-red-600 font-medium">{error}</div>
                    ) : sales.length === 0 ? (
                        <div className="p-6 text-center text-gray-500">No sales records found.</div>
                    ) : (
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 text-left font-semibold text-gray-700">Invoice ID</th>
                                    <th className="p-3 text-left font-semibold text-gray-700">Party Name</th>
                                    <th className="p-3 text-right font-semibold text-gray-700">Amount</th>
                                    <th className="p-3 text-left font-semibold text-gray-700">Date</th>
                                    <th className="p-3 text-left font-semibold text-gray-700">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sales.map((sale) => (
                                    <tr key={sale.id} className="hover:bg-gray-100 transition-colors">
                                        <td className="p-3 font-medium text-blue-600">{sale.voucherId}</td>
                                        <td className="p-3 text-gray-800">{sale.partyName}</td>
                                        <td className="p-3 text-right font-bold text-green-600">₹{sale.totalAmount?.toFixed(2) || '0.00'}</td>
                                        <td className="p-3 text-gray-500">{sale.createdAt ? sale.createdAt.toLocaleDateString() : 'N/A'}</td>
                                        <td className="p-3">
                                            <button
                                                onClick={() => handleDownloadPdf(sale)}
                                                disabled={pdfGenerating === sale.id}
                                                className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                                            >
                                                {pdfGenerating === sale.id ? <Spinner size="h-4 w-4" /> : 'Download PDF'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
};

export default SalesHistoryPage;