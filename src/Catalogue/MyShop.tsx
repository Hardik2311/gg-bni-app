import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useDatabase } from '../context/auth-context';
import type { Item } from '../constants/models'; // Make sure to export/import ItemGroup
import { ROUTES } from '../constants/routes.constants';
import { FiSearch, FiEdit } from 'react-icons/fi';

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
    const navigate = useNavigate();

    // State for items, categories, and filters
    const [items, setItems] = useState<Item[]>([]);
    const [categories, setCategories] = useState<string[]>(['All']);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // State for page loading and errors
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

                // Fetch items and item groups (categories) simultaneously
                // We assume getItemGroups() returns ItemGroup[]
                const [fetchedItems, fetchedItemGroups] = await Promise.all([
                    dbOperations.getItems(),
                    dbOperations.getItemGroups()
                ]);

                setItems(fetchedItems);

                // --- THIS IS THE FIX for the 'ItemGroup' is not 'string' error ---
                // We map the array of objects to an array of strings
                const categoryNames = fetchedItemGroups.map(group => group.name);
                setCategories(['All', ...categoryNames]);
                // -----------------------------------------------------------------

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

    // Memoized hook to filter items based on search and category
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const matchesCategory = selectedCategory === 'All' || item.itemGroupId === selectedCategory;
            const matchesSearch =
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.barcode && item.barcode.includes(searchQuery));

            // Both must be true for the item to show
            return matchesCategory && matchesSearch;
        });
    }, [items, selectedCategory, searchQuery]);

    // Handler to navigate to the item's edit page
    const handleEditItem = (itemId: string | undefined) => {
        if (!itemId) return;
        // Assuming you have a route like /items/:id
        navigate(`${ROUTES.ITEM_ADD}/${itemId}`);
    };

    // Loading State
    if (pageIsLoading) {
        return <div className="flex items-center justify-center h-full">Loading catalogue...</div>;
    }

    // Error State
    if (error) {
        return <div className="flex items-center justify-center h-full text-red-500">{error}</div>;
    }

    return (
        <div className="flex flex-col h-full bg-gray-100 w-full overflow-hidden">

            {/* --- HEADER --- */}
            <div className="flex-shrink-0 p-4 bg-white shadow-sm">
                <h1 className="text-3xl font-bold text-gray-800">My Shop Catalogue</h1>
                <p className="text-gray-500">
                    Browse, search, and manage all available items.
                </p>
            </div>

            {/* --- SEARCH & FILTER BAR (Sticky) --- */}
            <div className="flex-shrink-0 p-2 bg-white border-b sticky top-0 z-10">
                <div className="relative mb-2">
                    <input
                        type="text"
                        placeholder="Search by name or barcode..."
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
            <div className="flex-1 overflow-y-auto p-4">
                <p className="text-sm text-gray-600 mb-3">
                    Showing {filteredItems.length} of {items.length} total items
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredItems.map(item => (
                        <div
                            key={item.id}
                            className="bg-white rounded-lg shadow-sm overflow-hidden flex flex-col"
                        >
                            <div className="p-4 flex-grow">
                                <p className="font-semibold text-gray-800 break-words mb-2">{item.name}</p>
                                <p className="text-lg font-bold text-gray-900 mb-3">₹{item.mrp.toFixed(2)}</p>
                                <StockIndicator stock={item.Stock || 0} />
                            </div>
                            <button
                                onClick={() => handleEditItem(item.id)}
                                className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 p-2 text-sm font-medium flex items-center justify-center gap-2 border-t"
                            >
                                <FiEdit className="h-4 w-4" />
                                Edit
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MyShopPage;