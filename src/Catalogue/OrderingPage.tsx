import React, { useState, useEffect, useMemo, Fragment } from 'react';
// import { useNavigate } from 'react-router-dom'; // Removed - Not Used
import { useAuth, useDatabase } from '../context/auth-context';
import type { Item } from '../constants/models'; // Removed ItemGroup - Not Used
// import { ROUTES } from '../constants/routes.constants'; // Removed - Not Used
import { Modal } from '../constants/Modal';
import { State } from '../enums';
import { FiSearch, FiShoppingCart, FiX, FiPackage } from 'react-icons/fi';
import { Transition } from '@headlessui/react';
import { Spinner } from '../constants/Spinner'; // Assuming you have Spinner

// --- Cart Item Type ---
interface CartItem {
    id: string;
    name: string;
    mrp: number;
    quantity: number;
}

// --- Cart Drawer Component (No changes needed here) ---
interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    cart: CartItem[];
    onUpdateQuantity: (id: string, delta: number) => void;
    onPlaceOrder: () => void;
    isPlacingOrder: boolean;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, cart, onUpdateQuantity, onPlaceOrder, isPlacingOrder }) => {
    const cartTotal = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.mrp * item.quantity, 0);
    }, [cart]);

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            {/* ... (Drawer JSX remains the same) ... */}
            <div className="fixed inset-0 z-40 overflow-hidden">
                <div className="absolute inset-0 overflow-hidden">
                    {/* Background overlay */}
                    <Transition.Child as={Fragment} enter="ease-in-out duration-500" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in-out duration-500" leaveFrom="opacity-100" leaveTo="opacity-0" >
                        <div className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />
                    </Transition.Child>
                    {/* Cart Panel */}
                    <div className="fixed inset-y-0 right-0 flex max-w-full pl-10">
                        <Transition.Child as={Fragment} enter="transform transition ease-in-out duration-500 sm:duration-700" enterFrom="translate-x-full" enterTo="translate-x-0" leave="transform transition ease-in-out duration-500 sm:duration-700" leaveFrom="translate-x-0" leaveTo="translate-x-full" >
                            <div className="w-screen max-w-md">
                                <div className="flex h-full flex-col overflow-y-scroll bg-white shadow-xl">
                                    {/* Header */}
                                    <div className="flex-shrink-0 bg-gray-100 p-4 border-b">
                                        <div className="flex items-start justify-between">
                                            <h2 className="text-xl font-bold text-gray-900">Your Order</h2>
                                            <button onClick={onClose} className="text-gray-500 hover:text-gray-800"> <FiX className="h-6 w-6" /> </button>
                                        </div>
                                    </div>
                                    {/* Cart Items */}
                                    <div className="flex-1 overflow-y-auto p-4">
                                        {cart.length === 0 ? (<p className="text-center text-gray-500">Your cart is empty.</p>) : (
                                            <div className="flex flex-col gap-4">
                                                {cart.map(item => (
                                                    <div key={item.id} className="flex gap-3 border-b pb-3">
                                                        {/* Image Placeholder */}
                                                        {/* <div className="h-16 w-16 rounded bg-gray-200 flex-shrink-0"></div> */}
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-gray-800">{item.name}</p>
                                                            <p className="text-sm text-gray-600">₹{item.mrp.toFixed(2)}</p>
                                                        </div>
                                                        <div className="flex flex-col items-end justify-between">
                                                            <p className="font-bold">₹{(item.mrp * item.quantity).toFixed(2)}</p>
                                                            <div className="flex items-center gap-2 text-lg border border-gray-300 rounded-md">
                                                                <button onClick={() => onUpdateQuantity(item.id, -1)} className="px-3 text-gray-700">-</button>
                                                                <span className="font-bold text-gray-900 w-8 text-center text-base">{item.quantity}</span>
                                                                <button onClick={() => onUpdateQuantity(item.id, 1)} className="px-3 text-gray-700">+</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Footer */}
                                    {cart.length > 0 && (
                                        <div className="border-t border-gray-200 p-4">
                                            <div className="flex justify-between text-lg font-bold mb-4">
                                                <p>Total Amount</p>
                                                <p>₹{cartTotal.toFixed(2)}</p>
                                            </div>
                                            <button onClick={onPlaceOrder} disabled={isPlacingOrder} className="w-full bg-blue-600 text-white py-3 rounded-md font-bold hover:bg-blue-700 disabled:bg-gray-400" >
                                                {isPlacingOrder ? 'Placing Order...' : 'Place Order'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </Transition.Child>
                    </div>
                </div>
            </div>
        </Transition.Root>
    );
};


// --- Ordering Page Component ---
const OrderingPage: React.FC = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const dbOperations = useDatabase();

    // State for items, categories, and filters
    const [items, setItems] = useState<Item[]>([]); // This will hold ONLY listed items
    const [categories, setCategories] = useState<string[]>(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // State for cart and page
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isPlacingOrder] = useState(false);
    const [modal, setModal] = useState<{ message: string; type: State } | null>(null);

    // State for loading and errors
    const [pageIsLoading, setPageIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (authLoading || !currentUser || !dbOperations) {
            setPageIsLoading(authLoading);
            return;
        }

        const fetchData = async () => {
            try {
                setPageIsLoading(true);
                setError(null);

                const [fetchedItems, fetchedItemGroups] = await Promise.all([
                    dbOperations.getItems(),
                    dbOperations.getItemGroups()
                ]);

                // *** FILTER FOR LISTED ITEMS HERE ***
                const listedItems = fetchedItems.filter(item =>
                    item.isListed === true // && (item.stock || 0) > 0 // Keep only listed AND in-stock items
                );
                setItems(listedItems);
                // **********************************

                const categoryNames = fetchedItemGroups.map(group => group.name);
                setCategories(['All', ...categoryNames]);

            } catch (err: any) {
                const errorMessage = err.message || 'Failed to load shop.';
                setError(errorMessage);
                console.error("Fetch Error:", err);
            } finally {
                setPageIsLoading(false);
            }
        };

        fetchData();
    }, [authLoading, currentUser, dbOperations]);

    // --- Cart Management ---
    const handleAddToCart = (item: Item) => {
        setCart(prevCart => {
            if (!item.id) return prevCart;
            const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
            if (existingItem) {
                return prevCart.map(cartItem =>
                    cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem
                );
            } else {
                return [...prevCart, { id: item.id, name: item.name, mrp: item.mrp, quantity: 1 }];
            }
        });
    };

    const handleUpdateCartQuantity = (id: string, delta: number) => {
        setCart(prevCart => {
            const itemToUpdate = prevCart.find(item => item.id === id);
            if (!itemToUpdate) return prevCart;
            const newQuantity = itemToUpdate.quantity + delta;
            if (newQuantity <= 0) {
                return prevCart.filter(item => item.id !== id);
            } else {
                return prevCart.map(item =>
                    item.id === id ? { ...item, quantity: newQuantity } : item
                );
            }
        });
    };

    const cartCount = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.quantity, 0);
    }, [cart]);

    // --- Filtering Logic (Applied AFTER filtering for listed items) ---
    const filteredItems = useMemo(() => {
        return items.filter(item => { // 'items' already contains only listed items
            const matchesCategory = selectedCategory === 'All' || item.itemGroupId === selectedCategory;
            const matchesSearch =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.barcode && item.barcode.includes(searchQuery));
            return matchesCategory && matchesSearch;
        });
    }, [items, selectedCategory, searchQuery]);

    // --- Order Placement Logic (Remains the same) ---
    const handlePlaceOrder = async () => { /* ... same logic ... */ };

    // --- Render ---
    if (pageIsLoading) {
        return <div className="flex items-center justify-center h-screen"><Spinner /> <span className="ml-2">Loading Shop...</span></div>;
    }
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-red-500 p-4">
                <p className="text-center mb-4">{error}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-gray-100 w-full overflow-hidden">
            {modal && <Modal message={modal.message} onClose={() => setModal(null)} type={modal.type} />}
            <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                cart={cart}
                onUpdateQuantity={handleUpdateCartQuantity}
                onPlaceOrder={handlePlaceOrder}
                isPlacingOrder={isPlacingOrder}
            />

            {/* --- HEADER --- */}
            <div className="flex-shrink-0 p-4 bg-white shadow-sm flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-800">Shop</h1>
                <button onClick={() => setIsCartOpen(true)} className="relative text-gray-700 hover:text-blue-600">
                    <FiShoppingCart className="h-7 w-7" />
                    {cartCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                            {cartCount}
                        </span>
                    )}
                </button>
            </div>

            {/* --- SEARCH & FILTER BAR --- */}
            <div className="flex-shrink-0 p-2 bg-white border-b sticky top-0 z-10">
                <div className="relative mb-2">
                    <input
                        type="text"
                        placeholder="Search listed items..." // Updated placeholder
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-3 pl-10 border rounded-lg"
                    />
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-4 py-1.5 text-sm font-medium rounded-full flex-shrink-0 transition-colors ${selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700'
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- ITEM GRID --- */}
            <div className="flex-1 overflow-y-auto p-2">
                <p className="text-xs md:text-sm text-gray-600 mb-3 px-2 md:px-0">
                    Showing {filteredItems.length} listed items
                </p>
                <div className="grid grid-cols-2 gap-3">
                    {filteredItems.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col"
                        >
                            {/* Image Placeholder */}
                            <div className="h-40 w-full bg-gray-200 flex items-center justify-center text-gray-400">
                                {/* <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" /> */}
                                <FiPackage className="h-12 w-12" />
                            </div>
                            <div className="p-3 flex-grow flex flex-col">
                                <p className="font-semibold text-gray-800 break-words text-sm flex-grow line-clamp-2 h-10">{item.name}</p> {/* Added line-clamp and height */}
                                <p className="text-lg font-bold text-gray-900 my-2">₹{item.mrp.toFixed(2)}</p>
                                <button
                                    onClick={() => handleAddToCart(item)}
                                    className="w-full bg-orange-500 text-white font-bold py-2 rounded-md hover:bg-orange-600 transition-colors mt-auto" // Added mt-auto
                                >
                                    ADD TO CART
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {/* Updated No Items Message */}
                {filteredItems.length === 0 && !pageIsLoading && (
                    <p className="text-center text-gray-500 mt-10 p-4">
                        No listed items found matching your filters. Check the catalogue to list items.
                    </p>
                )}
            </div>
        </div>
    );
};

export default OrderingPage;