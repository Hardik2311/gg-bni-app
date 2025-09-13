import React, { createContext, useState, useContext, type ReactNode, useEffect } from 'react';
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarTrigger,
} from "./ui/menubar";

interface FilterState {
    startDate: string;
    endDate: string;
    filterType: string;
}

interface FilterContextType {
    filters: FilterState;
    setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
    const [filters, setFilters] = useState<FilterState>({
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        filterType: 'today',
    });

    return (
        <FilterContext.Provider value={{ filters, setFilters }}>
            {children}
        </FilterContext.Provider>
    );
};

export const useFilter = (): FilterContextType => {
    const context = useContext(FilterContext);
    if (context === undefined) {
        throw new Error('useFilter must be used within a FilterProvider');
    }
    return context;
};


export const FilterControls: React.FC = () => {
    const { filters, setFilters } = useFilter();
    const [localFilters, setLocalFilters] = useState<FilterState>(filters);

    // Sync local state if global filters change
    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    // Effect to update dates based on the selected preset
    useEffect(() => {
        const today = new Date();
        let newStartDate = localFilters.startDate;
        let newEndDate = localFilters.endDate;

        switch (localFilters.filterType) {
            case 'today':
                newStartDate = formatDate(today); newEndDate = formatDate(today); break;
            case 'yesterday':
                const y = new Date(); y.setDate(y.getDate() - 1);
                newStartDate = formatDate(y); newEndDate = formatDate(y); break;
            case 'last7days':
                const l7 = new Date(); l7.setDate(l7.getDate() - 6);
                newStartDate = formatDate(l7); newEndDate = formatDate(today); break;
            case 'last30days':
                const l30 = new Date(); l30.setDate(l30.getDate() - 29);
                newStartDate = formatDate(l30); newEndDate = formatDate(today); break;
            case 'custom':
                return;
        }

        if (newStartDate !== localFilters.startDate || newEndDate !== localFilters.endDate) {
            setLocalFilters(f => ({ ...f, startDate: newStartDate, endDate: newEndDate }));
        }
    }, [localFilters.filterType]);

    const handlePresetSelect = (preset: string) => {
        setLocalFilters(f => ({ ...f, filterType: preset }));
    };

    const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
        setLocalFilters(f => ({ ...f, [field]: value, filterType: 'custom' }));
    };

    const handleApply = () => {
        setFilters(localFilters);
    };

    const presetLabels: { [key: string]: string } = {
        today: "Today", yesterday: "Yesterday", last7days: "Last 7 Days",
        last30days: "Last 30 Days", custom: "Custom Range"
    };

    return (
        <div className="bg-white p-4 rounded-lg shadow-md w-full max-w-lg mx-auto">
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Menubar className="sm:col-span-1">
                        <MenubarMenu>
                            <MenubarTrigger className="w-full justify-center">
                                {presetLabels[localFilters.filterType]}
                                <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </MenubarTrigger>
                            <MenubarContent>
                                <MenubarItem onClick={() => handlePresetSelect('today')}>Today</MenubarItem>
                                <MenubarItem onClick={() => handlePresetSelect('yesterday')}>Yesterday</MenubarItem>
                                <MenubarItem onClick={() => handlePresetSelect('last7days')}>Last 7 Days</MenubarItem>
                                <MenubarItem onClick={() => handlePresetSelect('last30days')}>Last 30 Days</MenubarItem>
                                <MenubarSeparator />
                                <MenubarItem onClick={() => handlePresetSelect('custom')}>Custom Range</MenubarItem>
                            </MenubarContent>
                        </MenubarMenu>
                    </Menubar>
                    <div className="sm:col-span-2 grid grid-cols-2 gap-4">
                        <input type="date" value={localFilters.startDate} onChange={(e) => handleDateChange('startDate', e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                        <input type="date" value={localFilters.endDate} onChange={(e) => handleDateChange('endDate', e.target.value)} className="w-full p-2 text-sm border border-slate-300 rounded-md" />
                    </div>
                </div>
                <div>
                    <button
                        onClick={handleApply}
                        className="w-full px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 transition-colors"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
};