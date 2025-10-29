import React, { useState, useEffect, useMemo } from 'react';
import { useAuth, useDatabase } from '../context/auth-context'; // Adjust path if needed
import type { Item } from '../constants/models';     // Adjust path if needed
import { FiSearch, FiEdit, FiStar, FiCheckSquare, FiLoader } from 'react-icons/fi'; // Added Loader
import { ItemEditDrawer } from '../Components/ItemDrawer'; // Re-import the Drawer component (Adjust path if needed)
import { Spinner } from '../constants/Spinner'; // Assuming you have a Spinner

// A small helper component to show colored stock levels
const StockIndicator: React.FC<{ stock: number }> = ({ stock }) => {
    let colorClass = 'text-green-600 bg-green-100';
    if (stock <= 10 && stock > 0) colorClass = 'text-yellow-600 bg-yellow-100';
    if (stock <= 0) colorClass = 'text-red-600 bg-red-100';

    return (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
            {stock} in stock
        </span>
    );
};

// --- Separate Toggle Component for Quick Listing ---
interface QuickListedToggleProps {
    itemId: string;
    isListed: boolean;
    onToggle: (itemId: string, newState: boolean) => Promise<void>;
    disabled?: boolean;
}

const QuickListedToggle: React.FC<QuickListedToggleProps> = ({ itemId, isListed, onToggle, disabled }) => {
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        if (disabled || isLoading) return;
        setIsLoading(true);
        try {
            await onToggle(itemId, !isListed);
        } catch (error) {
            console.error("Error toggling listed status:", error);
            // Optionally show an error to the user via state or context
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <button
            onClick={handleClick}
            disabled={disabled || isLoading}
            className={`flex-1 p-2 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 border-l transition-colors disabled:opacity-50 ${ // Added flex-1
                isListed
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                }`}
            title={isListed ? "Unlist Item" : "List Item"}
        >
            {isLoading ? (
                <FiLoader className="h-4 w-4 animate-spin" />
            ) : isListed ? (
                <FiCheckSquare className="h-4 w-4 text-green-600" />
            ) : (
                <FiStar className="h-4 w-4" />
            )}
            {/* Removed text to make it fit better */}
        </button>
    );
};
// --- END Toggle ---


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
    const [error, setError] = useState<string | null>(null); // For general page/fetch errors
    const [updateError, setUpdateError] = useState<string | null>(null); // For specific update errors
    const [listAllLoading, setListAllLoading] = useState(false); // Loading state for List All button

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
                setPageIsLoading(true); setError(null);
                const [fetchedItems, fetchedItemGroups] = await Promise.all([
                    dbOperations.getItems(),
                    dbOperations.getItemGroups() // Assuming returns { name: string }[] or ItemGroup[]
                ]);
                setItems(fetchedItems);
                const categoryNames = fetchedItemGroups.map(group => group.name);
                setCategories(['All', ...categoryNames]);
            } catch (err: any) { // Catch specific error type
                const errorMessage = err.message || 'Failed to load shop catalogue.';
                setError(errorMessage);
                console.error("Fetch Error:", err);
            } finally {
                setPageIsLoading(false);
            }
        };
        fetchData();
    }, [authLoading, currentUser, dbOperations]);

    // --- Filter Items ---
    const filteredItems = useMemo(() => {
        return items.filter(item => {
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
        setTimeout(() => setSelectedItemForEdit(null), 300);
    };

    // Callback after successful save *in the drawer*
    const handleSaveSuccess = (updatedItemData: Partial<Item>) => {
        setItems(prevItems => prevItems.map(item =>
            item.id === selectedItemForEdit?.id
                ? { ...item, ...updatedItemData, id: item.id } as Item
                : item
        ));
        setUpdateError(null); // Clear any previous update errors on success
        console.log("Item updated successfully via drawer.");
    };

    // --- Handler for Quick Toggle ---
    const handleToggleListed = async (itemId: string, newState: boolean) => {
        setUpdateError(null); // Clear previous errors
        try {
            await dbOperations.updateItem(itemId, { isListed: newState });
            // Update local state
            setItems(prevItems => prevItems.map(item =>
                item.id === itemId ? { ...item, isListed: newState } as Item : item
            ));
        } catch (err: any) { // Catch specific error
            console.error("Failed to update listed status:", err);
            setUpdateError(err.message || "Failed to update item status.");
            throw err; // Re-throw so toggle knows it failed
        }
    };

    // --- Handler to List All Filtered Items ---
    const handleListAllFiltered = async () => {
        const itemsToList = filteredItems.filter(item => !item.isListed && item.id); // Filter out already listed and those without ID
        if (itemsToList.length === 0) return;

        setListAllLoading(true);
        setUpdateError(null); // Clear previous errors
        try {
            const updatePromises = itemsToList.map(item =>
                dbOperations.updateItem(item.id!, { isListed: true }) // Use non-null assertion for id
            );
            await Promise.all(updatePromises);

            // Update local state for all affected items
            const updatedItemIds = new Set(itemsToList.map(item => item.id));
            setItems(prevItems => prevItems.map(item =>
                updatedItemIds.has(item.id) ? { ...item, isListed: true } as Item : item
            ));

        } catch (err: any) { // Catch specific error
            console.error("Failed to list all items:", err);
            setUpdateError(err.message || "Failed to list all items. Please try again.");
        } finally {
            setListAllLoading(false);
        }
    };


    // --- Render Logic ---
    if (pageIsLoading) {
        return <div className="flex items-center justify-center h-screen"><Spinner /> <span className="ml-2">Loading catalogue...</span></div>;
    }

    // Display fetch error
    if (error && !listAllLoading) { // Avoid showing fetch error during list all operation
        return (
            <div className="flex flex-col items-center justify-center h-screen text-red-500 p-4">
                <p className="text-center mb-4">{error}</p>
                <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                    Retry
                </button>
            </div>
        );
    }

    // Calculate count of unlisted items in the current filter
    const unlistedFilteredCount = filteredItems.filter(item => !item.isListed).length;


    return (
        <div className="flex flex-col h-screen bg-gray-100 w-full">
            {/* --- HEADER --- */}
            <div className="flex-shrink-0 p-4 bg-white shadow-sm">
                <h1 className="text-2xl md:text-3xl font-bold text-gray-800">My Shop Catalogue</h1>
                <p className="text-gray-500 text-sm md:text-base">
                    Browse, search, manage items, and toggle listing status.
                </p>
                {/* Display update errors */}
                {updateError && <p className="text-red-500 bg-red-100 p-2 rounded text-sm mt-2">{updateError}</p>}
            </div>

            {/* --- SEARCH & FILTER BAR --- */}
            <div className="flex-shrink-0 p-2 bg-white border-b sticky top-0 z-10">
                {/* Search Input */}
                <div className="relative mb-2">
                    <input type="text" placeholder="Search by name or barcode..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-3 pl-10 border rounded-lg text-sm md:text-base" />
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                </div>
                {/* Category Buttons */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {categories.map(category => (<button key={category} onClick={() => setSelectedCategory(category)} className={`px-3 md:px-4 py-1.5 text-xs md:text-sm font-medium rounded-full flex-shrink-0 transition-colors ${selectedCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`} > {category} </button>))}
                </div>
                {/* --- List All Button --- */}
                <div className="pt-2 mt-2 border-t">
                    <button
                        onClick={handleListAllFiltered}
                        disabled={listAllLoading || filteredItems.length === 0 || unlistedFilteredCount === 0}
                        className="w-full bg-blue-500 text-white font-semibold py-2 px-4 rounded-md text-sm hover:bg-blue-600 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {listAllLoading ? (
                            <Spinner />
                        ) : (
                            <FiCheckSquare size={16} />
                        )}
                        {listAllLoading ? 'Listing...' : `List ${unlistedFilteredCount > 0 ? `(${unlistedFilteredCount}) ` : ''}Filtered Items`}
                    </button>
                </div>
                {/* --------------------- */}
            </div>

            {/* --- ITEM GRID --- */}
            <div className="flex-1 overflow-y-auto p-2 md:p-4">
                <p className="text-xs md:text-sm text-gray-600 mb-3 px-2 md:px-0">
                    Showing {filteredItems.length} of {items.length} total items
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-4">
                    {filteredItems.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col border border-gray-200 transition-shadow hover:shadow-md"
                        >
                            {/* --- Item Details --- */}
                            <div className="p-3 md:p-4 flex-grow relative">
                                <p className="font-semibold text-gray-800 break-words mb-2 text-sm md:text-base line-clamp-2 h-10 md:h-12">{item.name}</p>
                                <p className="text-base md:text-lg font-bold text-gray-900 mb-3">₹{item.mrp.toFixed(2)}</p>
                                {/* Ensure correct stock field name */}
                                <StockIndicator stock={item.stock || 0} />

                                {/* Listed Indicator Badge */}
                                {item.isListed && (
                                    <div className="absolute top-2 right-2 bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                        <FiStar size={10} /> Listed
                                    </div>
                                )}
                            </div>

                            {/* --- Action Buttons Footer --- */}
                            <div className="flex border-t">
                                {/* Edit Button */}
                                <button
                                    onClick={() => handleOpenEditDrawer(item)}
                                    className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 p-2 text-xs md:text-sm font-medium flex items-center justify-center gap-1 md:gap-2 border-r" // Added border-r
                                >
                                    <FiEdit className="h-3 w-3 md:h-4 md:w-4" /> Edit
                                </button>
                                {/* Listed Toggle Button */}
                                <QuickListedToggle
                                    itemId={item.id!} // Assert non-null ID
                                    isListed={item.isListed ?? false}
                                    onToggle={handleToggleListed}
                                    disabled={listAllLoading} // Disable individual toggles while "List All" is running
                                />
                            </div>
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

            {/* --- EDIT DRAWER INSTANCE --- */}
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