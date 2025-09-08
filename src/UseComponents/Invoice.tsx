import React from 'react';

// Define a type for the data your invoice component will receive
interface InvoiceProps {
    voucherId: string;
    partyName: string;
    partyNumber?: string;
    subtotal: number;
    discount: number;
    finalAmount: number;
    items: {
        name: string;
        quantity: number;
        mrp: number; // For List Price
        gst?: number;
        hsnSac?: string;
        unit?: string;
    }[];
    paymentDetails: { [key: string]: number };
}

const Invoice: React.FC<InvoiceProps> = ({
    voucherId,
    partyName,
    partyNumber,
    subtotal,
    discount,
    finalAmount,
    items,
    paymentDetails,
}) => {
    const currentDate = new Date().toLocaleDateString('en-GB');
    const totalDiscount = subtotal * (discount / 100);

    return (
        <div id="invoice-bill" className="bg-white p-6 md:p-10 rounded-lg shadow-xl text-gray-800 font-sans" style={{ width: '210mm', minHeight: '297mm' }}>
            <header className="text-center bg-blue-900 text-white py-4 rounded-t-lg">
                <h1 className="text-2xl font-bold">Giftinguru.com</h1>
            </header>

            <div className="p-4 border border-gray-300">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-lg font-bold mb-1">Bill To</h2>
                        <p className="text-sm font-semibold">{partyName}</p>
                        <p className="text-xs text-gray-600">420, kavya enclave, Indraprost,</p>
                        <p className="text-xs text-gray-600">New Delhi - 443567</p>
                        {partyNumber && <p className="text-xs text-blue-600 font-medium mt-1">
                            +91 - {partyNumber.replace(/(\d{5})(\d{5})/, '$1 $2')}
                        </p>}
                    </div>
                    <div className="text-right text-sm">
                        <div className="grid grid-cols-2 gap-x-2">
                            <span className="font-semibold text-gray-700">Invoice No.</span>
                            <span className="font-bold text-blue-600">{voucherId}</span>
                            <span className="font-semibold text-gray-700">Date</span>
                            <span className="font-medium">{currentDate}</span>
                            <span className="font-semibold text-gray-700">Billed By</span>
                            <span className="font-medium">Bhavesh Agrawal</span>
                        </div>
                    </div>
                </div>

                <section className="mb-4">
                    <table className="w-full text-left border border-gray-400 text-xs">
                        <thead>
                            <tr className="bg-gray-100 font-semibold text-gray-700">
                                <th className="p-2 border-r border-b border-gray-400">S. No.</th>
                                <th className="p-2 border-r border-b border-gray-400">Product</th>
                                <th className="p-2 border-r border-b border-gray-400">HSN/SAC</th>
                                <th className="p-2 border-r border-b border-gray-400 text-center">Qty</th>
                                <th className="p-2 border-r border-b border-gray-400">Unit</th>
                                <th className="p-2 border-r border-b border-gray-400 text-right">List Price</th>
                                <th className="p-2 border-r border-b border-gray-400 text-right">GST (%)</th>
                                <th className="p-2 border-r border-b border-gray-400 text-right">Disc Amt.</th>
                                <th className="p-2 border-b border-gray-400 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td className="p-2 border-r border-b border-gray-400">{index + 1}</td>
                                    <td className="p-2 border-r border-b border-gray-400">{item.name}</td>
                                    <td className="p-2 border-r border-b border-gray-400">{item.hsnSac || 'N/A'}</td>
                                    <td className="p-2 border-r border-b border-gray-400 text-center">{item.quantity}</td>
                                    <td className="p-2 border-r border-b border-gray-400">{item.unit || 'Pcs.'}</td>
                                    <td className="p-2 border-r border-b border-gray-400 text-right">₹{item.mrp.toFixed(2)}</td>
                                    <td className="p-2 border-r border-b border-gray-400 text-right">
                                        {item.gst ? `${item.gst.toFixed(0)}%` : 'N/A'}
                                    </td>
                                    <td className="p-2 border-r border-b border-gray-400 text-right">₹{totalDiscount.toFixed(2)}</td>
                                    <td className="p-2 border-b border-gray-400 text-right">₹{(item.mrp * item.quantity).toFixed(2)}</td>
                                </tr>
                            ))}
                            <tr>
                                <td colSpan={8} className="p-2 text-right font-bold text-gray-800 border-r border-b border-gray-400">GRAND TOTAL</td>
                                <td className="p-2 text-right font-bold text-lg text-blue-600 border-b border-gray-400">₹{finalAmount.toFixed(2)}</td>
                            </tr>
                        </tbody>
                    </table>
                </section>

                {/* FIX: This section now dynamically displays payment details */}
                <section className="mb-4 flex justify-between gap-4 text-xs">
                    <div className="flex-1 p-3 border border-gray-400 rounded-md">
                        <h3 className="font-semibold mb-2">Payment Information</h3>
                        {Object.entries(paymentDetails).map(([mode, amount]) => (
                            <div key={mode} className="grid grid-cols-2 gap-x-2">
                                <span className="text-gray-600 capitalize">{mode}:</span>
                                <span className="font-medium">₹{amount.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex-1 p-3 border border-gray-400 rounded-md">
                        <h3 className="font-semibold mb-2">Bank Details</h3>
                        <div className="grid grid-cols-2 gap-x-2">
                            <span className="text-gray-600">GSTIN:</span>
                            <span className="font-medium">09ABHRI644A1ZJ</span>
                        </div>
                    </div>
                </section>

                <section className="mb-6 border border-gray-400 rounded-md p-3 text-xs text-gray-700">
                    <h3 className="font-bold mb-2">Terms & Conditions</h3>
                    <p>Lorem ipsum blah blah and terms and conditions and what not blah blah blah blah blah blah blah</p>
                </section>

                <div className="flex justify-end pr-8 mb-4">
                    <p className="text-xs font-semibold border-t border-gray-500 pt-1">Authorised Sign</p>
                </div>
            </div>

            <footer className="text-center bg-blue-900 text-white py-2 mt-4 rounded-b-lg text-xs flex justify-between px-6">
                <p>Shop no. 5R Gaur Siddartham...</p>
                <p>giftingurusiddharthwihan@gmail.com</p>
                <p>Generated through SELLAR</p>
            </footer>
        </div>
    );
};

export default Invoice;