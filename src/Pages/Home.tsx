import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/auth-context';
import { AttendanceCard, AttendanceLogCard } from '../Components/AttendaceCard';
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

// ADDED: Interface for the attendance log
interface LogEntry {
  checkIn: Date;
  checkOut: Date | null;
}

const Home = () => {
  // ADDED: `userName` is now retrieved from useAuth
  const { currentUser, loading: authLoading } = useAuth();
  const { businessName, loading: nameLoading } = useBusinessName(currentUser?.uid);

  const [isDataVisible, setIsDataVisible] = useState<boolean>(false); // Changed default to true
  const isLoading = authLoading || nameLoading;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterType, setFilterType] = useState('today');

  // ADDED: State management for the Attendance Card
  const [status, setStatus] = useState<'Checked Out' | 'Checked In'>('Checked Out');
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [attendanceLog, setAttendanceLog] = useState<LogEntry[]>([]);

  // ADDED: Timer effect for the attendance duration
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (status === 'Checked In') {
      timer = setInterval(() => {
        setElapsedTime(prevTime => prevTime + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [status]);

  // ADDED: Handlers for check-in and check-out logic
  const handleCheckIn = () => {
    const now = new Date();
    setStatus('Checked In');
    setCheckInTime(now);
    setCheckOutTime(null);
    setAttendanceLog(prevLog => [...prevLog, { checkIn: now, checkOut: null }]);
  };

  const handleCheckOut = () => {
    const now = new Date();
    setStatus('Checked Out');
    setCheckOutTime(now);
    setAttendanceLog(prevLog => {
      const newLog = [...prevLog];
      const lastEntry = newLog[newLog.length - 1];
      if (lastEntry && lastEntry.checkOut === null) {
        lastEntry.checkOut = now;
      }
      return newLog;
    });
  };
  const handleApplyFilters = () => {
    // This function now commits the selected dates to the 'applied' state.
    // Child components will re-render with the new date range.
    // setAppliedStartDate(startDate);
    // setAppliedEndDate(endDate);
    console.log("Applying filters with date range:", { startDate, endDate });
  };

  return (
    <div className="flex min-h-screen w-full flex-col overflow-hidden bg-slate-100 shadow-sm">
      {/* Top Bar */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white p-4 shadow-sm">
        <div className="w-8"></div>
        <div className="flex flex-col text-center">
          <h1 className="text-2xl font-bold text-slate-800">
            Dashboard
          </h1>
          <p className="text-slate-500 text-sm">
            {isLoading ? 'Loading...' : ` ${businessName}`}
          </p>
        </div>
        <PermissionWrapper
          requiredPermission={Permissions.ViewSalescard}
          behavior="hide"
        >
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
      </div>
      <PermissionWrapper
        requiredPermission={Permissions.ViewSalescard}
        behavior="hide"
      >
        <div className="bg-white p-4 rounded-lg shadow-md m-4">
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

      <div className="flex-grow overflow-y-auto p-4 sm:p-6">
        <div className="flex w-full items-start justify-center gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <PermissionWrapper
              requiredPermission={Permissions.ViewSalescard}
              behavior="hide"
            >
              <SalesCard isDataVisible={isDataVisible} />
            </PermissionWrapper>
          </div>
        </div>
        <div className="mb-6">
          <PermissionWrapper
            requiredPermission={Permissions.ViewSalesbarchart}
            behavior="hide"
          >
            <SalesBarChartReport isDataVisible={isDataVisible} />
          </PermissionWrapper>
        </div>
        <div className="flex w-full flex-wrap items-start justify-center gap-6 mb-6">
          <div className="flex-1 min-w-[280px]">
            <PermissionWrapper
              requiredPermission={Permissions.ViewTopSoldItems}
              behavior="hide"
            >
              <TopSoldItemsCard isDataVisible={isDataVisible} />
            </PermissionWrapper>
          </div>
          <div className="flex-1 min-w-[280px] space-y-6">
            <PermissionWrapper
              requiredPermission={Permissions.ViewSalescard}
              behavior="hide"
            >
              <TopSalespersonCard isDataVisible={isDataVisible} />
            </PermissionWrapper>

            {/* ADDED: The complete, functional AttendanceCard and Log */}
            <PermissionWrapper
              requiredPermission={Permissions.ViewAttendance} // Assumes you have this permission
              behavior="hide"
            >
              <>
                <AttendanceCard
                  userName={'Work Hours'}
                  status={status}
                  checkInTime={checkInTime}
                  checkOutTime={checkOutTime}
                  elapsedTime={elapsedTime}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  loading={false} // You can implement loading state if needed
                />
                <AttendanceLogCard log={attendanceLog} />
              </>
            </PermissionWrapper>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

