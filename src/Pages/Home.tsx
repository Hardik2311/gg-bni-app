import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/auth-context';
import { AttendancePage } from '../Components/AttendaceCard';
import { SalesBarChartReport } from '../Components/SBGraph';
import { SalesCard } from '../Components/SCard';
import { TopSoldItemsCard } from '../Components/TFCard';
import { TopSalespersonCard } from '../Components/TSCard';
import PermissionWrapper from '../context/PermissionWrapper';
import { Permissions } from '../enums';

const FilterDateInput: React.FC<{ value: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void, placeholder: string }> = ({ value, onChange, placeholder }) => (
  <input
    type="date"
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
  />
);

const FilterSelect: React.FC<{ value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }> = ({ value, onChange }) => (
  <select
    value={value}
    onChange={onChange}
    className="w-full p-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
  >
    <option value="today">Today</option>
    <option value="yesterday">Yesterday</option>
    <option value="last7days">Last 7 Days</option>
    <option value="last30days">Last 30 Days</option>
  </select>
);

const useBusinessName = (userId?: string) => {
  const [businessName, setBusinessName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const fetchBusinessInfo = async () => {
      try {
        const docRef = doc(db, 'business_info', userId);
        const docSnap = await getDoc(docRef);
        setBusinessName(docSnap.exists() ? docSnap.data().businessName || 'Business' : 'Business');
      } catch (err) {
        setBusinessName('Business');
      } finally {
        setLoading(false);
      }
    };
    fetchBusinessInfo();
  }, [userId]);
  return { businessName, loading };
};


const Home = () => {
  const { currentUser, loading: authLoading } = useAuth();
  const { businessName, loading: nameLoading } = useBusinessName(currentUser?.uid);

  const [isDataVisible, setIsDataVisible] = useState<boolean>(true);
  const isLoading = authLoading || nameLoading;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState('today');

  const handleApplyFilters = () => {
    console.log("Applying filters with date range:", { startDate, endDate });
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100">
      {/* Header */}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-8"></div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500">{isLoading ? 'Loading...' : businessName}</p>
        </div>
        <PermissionWrapper requiredPermission={Permissions.ViewSalescard} behavior="hide">
          <button
            onClick={() => setIsDataVisible(!isDataVisible)}
            className="p-2 rounded-full hover:bg-slate-200 transition-colors"
            title={isDataVisible ? 'Hide Data' : 'Show Data'}
          >
            {isDataVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
            )}
          </button>
        </PermissionWrapper>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow overflow-y-auto p-4 sm:p-6">
        {/* Centering Container */}
        <div className="mx-auto max-w-7xl">

          {/* Filters */}
          <PermissionWrapper requiredPermission={Permissions.ViewSalescard} behavior="hide">
            <div className="bg-white p-4 rounded-lg shadow-md mb-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FilterDateInput value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="From Date" />
                <FilterDateInput value={endDate} onChange={(e) => setEndDate(e.target.value)} placeholder="To Date" />
                <FilterSelect value={filterType} onChange={(e) => setFilterType(e.target.value)} />
                <button onClick={handleApplyFilters} className="w-full p-2 bg-blue-600 text-white font-semibold rounded-md hover:bg-blue-700 transition">
                  Apply
                </button>
              </div>
            </div>
          </PermissionWrapper>

          {/* All Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <PermissionWrapper requiredPermission={Permissions.ViewSalescard} behavior="hide">
              <SalesCard isDataVisible={isDataVisible} />
            </PermissionWrapper>
            <PermissionWrapper requiredPermission={Permissions.ViewSalesbarchart} behavior="hide">
              <SalesBarChartReport isDataVisible={isDataVisible} />
            </PermissionWrapper>
            <PermissionWrapper requiredPermission={Permissions.ViewTopSoldItems} behavior="hide">
              <TopSoldItemsCard isDataVisible={isDataVisible} />
            </PermissionWrapper>
            <PermissionWrapper requiredPermission={Permissions.ViewSalescard} behavior="hide">
              <TopSalespersonCard isDataVisible={isDataVisible} />
            </PermissionWrapper>
            <PermissionWrapper requiredPermission={Permissions.ViewAttendance} behavior="hide">
              <AttendancePage />
            </PermissionWrapper>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Home;