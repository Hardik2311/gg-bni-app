import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.constants'; // Assuming you have this file
import {
    FiDollarSign,
    FiShoppingCart,
    FiPackage,
    FiUsers,
    FiTrendingUp,
    FiSettings,
    FiPlus,
    FiArchive,
    FiBookOpen
} from 'react-icons/fi'; // Using react-icons for a clean look

/**
 * NOTE: You will need to install react-icons if you haven't:
 * npm install react-icons
 */

const HomePage: React.FC = () => {
    const navigate = useNavigate();

    // --- Placeholder data for dashboard stats ---
    // In a real app, you would fetch this data
    const stats = {
        todaySales: 12500.75,
        todayPurchases: 4200.00,
        lowStockItems: 5,
    };

    // --- Main navigation items for your app's "catalogues" ---
    const navItems = [
        {
            name: 'Orders',
            route: ROUTES.ORDER, // Main sales page
            icon: FiTrendingUp,
            description: 'Create new sales and view sales returns.'
        },
        {
            name: 'Items Catalogue',
            route: ROUTES.MYSHOP, // Assuming ROUTES.ITEMS exists
            icon: FiPackage,
            description: 'Browse, add, and manage all your items.'
        },
        {
            name: 'Purchases',
            route: ROUTES.PURCHASE, // Assuming ROUTES.PURCHASES exists
            icon: FiShoppingCart,
            description: 'Log new stock and track all purchases.'
        },
        {
            name: 'Sales Journal',
            route: ROUTES.JOURNAL, // Assuming ROUTES.JOURNAL exists
            icon: FiBookOpen,
            description: 'View the complete history of all transactions.'
        },
        {
            name: 'Parties',
            route: ROUTES.PNL_REPORT, // Assuming ROUTES.PARTIES exists
            icon: FiUsers,
            description: 'Manage your customers and suppliers.'
        },
        {
            name: 'Settings',
            route: ROUTES.MASTERS, // Assuming ROUTES.SETTINGS exists
            icon: FiSettings,
            description: 'Configure app and account settings.'
        },
    ];

    return (
        <div className="flex flex-col h-full bg-gray-100 p-4 overflow-y-auto">
            {/* === HEADER === */}
            <h1 className="text-3xl font-bold text-gray-800 mb-4">Dashboard</h1>

            {/* === KEY STATS GRID === */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {/* Today's Sales Card */}
                <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full">
                        <FiDollarSign className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Today's Sales</p>
                        <p className="text-2xl font-bold text-gray-900">₹{stats.todaySales.toFixed(2)}</p>
                    </div>
                </div>

                {/* Today's Purchases Card */}
                <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-full">
                        <FiShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Today's Purchases</p>
                        <p className="text-2xl font-bold text-gray-900">₹{stats.todayPurchases.toFixed(2)}</p>
                    </div>
                </div>

                {/* Low Stock Items Card */}
                <div className="bg-white p-4 rounded-lg shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-full">
                        <FiArchive className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">Low Stock Items</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.lowStockItems}</p>
                    </div>
                </div>
            </div>

            {/* === QUICK ACTIONS === */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
                <button
                    onClick={() => navigate(ROUTES.SALES)}
                    className="flex-1 bg-blue-600 text-white font-semibold py-3 px-4 rounded-lg shadow-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                    <FiPlus className="h-5 w-5" />
                    New Sale
                </button>
                <button
                    onClick={() => navigate(ROUTES.PURCHASE)} // Adjust route as needed
                    className="flex-1 bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg shadow-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                    <FiShoppingCart className="h-5 w-5" />
                    New Purchase
                </button>
                <button
                    onClick={() => navigate(ROUTES.ITEM_ADD)} // Assuming a route like ITEMS_NEW
                    className="flex-1 bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg shadow-sm hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                    <FiPackage className="h-5 w-5" />
                    Add New Item
                </button>
            </div>

            {/* === MAIN NAVIGATION CATALOGUE === */}
            <h2 className="text-2xl font-semibold text-gray-700 mb-3">Catalogue</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {navItems.map((item) => (
                    <button
                        key={item.name}
                        onClick={() => navigate(item.route)}
                        className="bg-white p-6 rounded-lg shadow-sm hover:shadow-lg transition-shadow text-left flex items-center gap-4"
                    >
                        <div className="p-3 bg-gray-100 rounded-full">
                            <item.icon className="h-6 w-6 text-gray-700" />
                        </div>
                        <div>
                            <p className="text-lg font-semibold text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-600">{item.description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default HomePage;