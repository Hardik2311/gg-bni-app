import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/auth-context';
import { AttendancePage } from '../Components/AttendaceCard';
import { SalesBarChartReport } from '../Components/SBGraph';
import { SalesCard } from '../Components/SCard';
import { TopSoldItemsCard } from '../Components/TFCard';
import { TopSalespersonCard } from '../Components/TSCard';
import ShowWrapper from '../context/ShowWrapper';
import { Permissions } from '../enums';
import { FilterControls, FilterProvider } from '../Components/Filter';
import { PaymentChart } from '../Components/PaymentChart';
import { RestockAlertsCard } from '../Components/RestockItems';


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
  const [isDataVisible, setIsDataVisible] = useState<boolean>(false);
  const isLoading = authLoading || nameLoading;

  return (
    <FilterProvider>
      <div className="flex min-h-screen w-full flex-col bg-gray-100">
        {/* Header */}
        <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-300 bg-gray-100 p-2 ">
          <div className="w-14"></div>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
            <p className="text-sm text-slate-500">{isLoading ? 'Loading...' : businessName}</p>
          </div>
          <div className="w-14 flex justify-end">
            <ShowWrapper requiredPermission={Permissions.ViewSalescard}>
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
            </ShowWrapper>
          </div>
        </header>

        <main className="flex-grow overflow-y-auto p-2 sm:p-2">
          <div className="mx-auto max-w-7xl">
            <ShowWrapper requiredPermission={Permissions.ViewSalescard}>
              <div className="mb-2">
                <FilterControls />
              </div>
            </ShowWrapper>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pb-30">
              <ShowWrapper requiredPermission={Permissions.ViewSalescard}>
                <SalesCard isDataVisible={isDataVisible} />
              </ShowWrapper>
              <ShowWrapper requiredPermission={Permissions.ViewSalesbarchart}>
                <SalesBarChartReport isDataVisible={isDataVisible} />
              </ShowWrapper>
              <ShowWrapper requiredPermission={Permissions.ViewSalescard}>
                <PaymentChart isDataVisible={isDataVisible} />
              </ShowWrapper>
              <ShowWrapper requiredPermission={Permissions.ViewTopSoldItems} >
                <TopSoldItemsCard isDataVisible={isDataVisible} />
              </ShowWrapper>
              <ShowWrapper requiredPermission={Permissions.ViewSalescard}>
                <TopSalespersonCard isDataVisible={isDataVisible} />
              </ShowWrapper>
              <ShowWrapper requiredPermission={Permissions.ViewAttendance} >
                <AttendancePage />
              </ShowWrapper>
              <ShowWrapper requiredPermission={Permissions.Viewrestockcard}>
                <RestockAlertsCard />
              </ShowWrapper>
            </div>
          </div>
        </main>
      </div>
    </FilterProvider>
  );
};

export default Home;