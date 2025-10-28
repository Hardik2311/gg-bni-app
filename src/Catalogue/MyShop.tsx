import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, useDatabase } from '../context/auth-context'; // Adjust path if needed
import type { Item } from '../constants/models';     // Adjust path if needed
import { FiSearch, FiEdit } from 'react-icons/fi';
import { ItemEditDrawer } from '../Components/ItemDrawer'; // Import the Drawer component (Adjust path if needed)

// A small helper component to show colored stock levels
const StockIndicator: React.FC<{ stock: number }> = ({ stock }) => {
    let colorClass = 'text-green-600 bg-green-100';
    if (stock <= 10) colorClass = 'text-yellow-600 bg-yellow-100';
    if (stock <= 0) colorClass = 'text-red-600 bg-red-100';

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {stock} in stock
        </span>
    );
};


const MyShopPage: React.FC = () => {
    const { currentUser, loading: authLoading } = useAuth();
    const dbOperations = useDatabase();

    // State for items, categories, and filters
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<string[]>(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // State for page loading and errors
    const [pageIsLoading, setPageIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // --- State for Drawer ---
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [selectedItemForEdit, setSelectedItemForEdit] = useState<Item | null>(null);

    // --- Fetch Initial Data ---
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
                    dbOperations.getItemGroups() // Assuming returns { name: string }[] or ItemGroup[]
                ]);

                setItems(fetchedItems);

                // Ensure fetchedItemGroups is mapped correctly if it's ItemGroup[]
                const categoryNames = fetchedItemGroups.map(group => group.name);
                setCategories(['All', ...categoryNames]);

            } catch (err) {
                const errorMessage = 'Failed to load shop catalogue.';
                setError(errorMessage);
                console.error(errorMessage, err);
            } finally {
                setPageIsLoading(false);
            }
        };

        fetchData();
    }, [authLoading, currentUser, dbOperations]);

    // --- Filter Items ---
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            // Ensure correct field name from your Item model (e.g., itemGroupId or itemGroupID)
            const matchesCategory = selectedCategory === 'All' || item.itemGroupId === selectedCategory;
            const matchesSearch =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.barcode && item.barcode.includes(searchQuery));
            return matchesCategory && matchesSearch;
        });
    }, [items, selectedCategory, searchQuery]);

    // --- Drawer Handlers ---
    const handleOpenEditDrawer = (item: Item) => {
        setSelectedItemForEdit(item);
        setIsDrawerOpen(true);
    };

    const handleCloseEditDrawer = () => {
        setIsDrawerOpen(false);
        // Delay clearing the item slightly so drawer closes smoothly
        setTimeout(() => {
            setSelectedItemForEdit(null);
        }, 300); // Adjust timing if needed
    };

    // Callback function after successful save in the drawer
    const handleSaveSuccess = (updatedItemData: Partial<Item>) => {
        // Update local items state for immediate UI feedback
        setItems(prevItems => prevItems.map(item =>
            item.id === selectedItemForEdit?.id
                // Merge existing item data with the updated data
                // Ensure ID is preserved and cast back to Item type
                ? { ...item, ...updatedItemData, id: item.id } as Item
                : item
        ));
        // Optional: show a success toast/message if needed
        console.log("Item updated successfully in local state.");
    };


    // --- Render Logic ---
    if (pageIsLoading) {
        return <div className="flex items-center justify-center h-screen">Loading catalogue...</div>; // Use h-screen for full height
    }

    // Display fetch error
    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-screen text-red-500 p-4"> {/* Use h-screen */}
                <p className="text-center mb-4">{error}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Retry
                </button>
            </div>
        );
    }


    return (
        <div className="flex flex-col h-screen bg-gray-100 w-full"> {/* Use h-screen */}
            {/* --- HEADER --- */}
            <div className="flex-shrink-0 p-4 bg-white shadow-sm">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Shop Catalogue</h1>
                <p className="text-gray-500 text-sm md:text-base">
                    Browse, search, and manage all available items.
                </p>
                {/* Display save errors from drawer context if needed, or handle within drawer */}
            </div>

            {/* --- SEARCH & FILTER BAR --- */}
            <div className="flex-shrink-0 p-2 bg-white border-b sticky top-0 z-10">
                <div className="relative mb-2">
                    <input
                        type="text"
                        placeholder="Search by name or barcode..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full p-3 pl-10 border rounded-lg text-sm md:text-base" // Responsive text size
                    />
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-full flex-shrink-0 transition-colors ${selectedCategory === category
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300' // Added hover effect
                                }`}
                        >
                            {category}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- ITEM GRID --- */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4"> {/* Responsive padding */}
                <p className="text-xs md:text-sm text-gray-600 mb-3 px-2 md:px-0"> {/* Padding added */}
                    Showing {filteredItems.length} of {items.length} total items
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4"> {/* Responsive gaps and columns */}
                    {filteredItems.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col border border-gray-200 transition-shadow hover:shadow-md" // Added hover effect
                        >
                            {/* === Normal Display Section === */}
                            <div className="p-3 md:p-4 flex-grow"> {/* Responsive padding */}
                                <p className="font-semibold text-gray-800 break-words mb-2 text-sm md:text-base line-clamp-2">{item.name}</p> {/* Line clamp */}
                                <p className="text-base md:text-lg font-bold text-gray-900 mb-3">₹{item.mrp.toFixed(2)}</p>
                                {/* Ensure correct stock field name */}
                                <StockIndicator stock={item.stock || 0} />
                            </div>
                            <button
                                // --- EDIT BUTTON OPENS DRAWER ---
                                onClick={() => handleOpenEditDrawer(item)}
                                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 p-2 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 border-t" // Responsive text/gap
                            >
                                <FiEdit className="h-3 w-3 md:h-4 md:w-4" /> Edit
                            </button>
                        </div>
                    ))}
                </div>
                {/* --- No Items Found Message --- */}
                {filteredItems.length === 0 && !pageIsLoading && (
                    <div className="text-center text-gray-500 mt-10 p-4">
                        <p>No items found matching '{searchQuery}' in category '{selectedCategory}'.</p>
                    </div>
                )}
            </div>

            <ItemEditDrawer
                item={selectedItemForEdit}
                isOpen={isDrawerOpen}
                onClose={handleCloseEditDrawer}
                onSaveSuccess={handleSaveSuccess}
            />
        </div>
    );
};

export default MyShopPage;