import { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { useAuth } from '../context/auth-context';
import { Line, LineChart, CartesianGrid, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import type { ChartConfig } from './ui/chart';
import { useFilter } from './Filter';

interface SaleRecord {
  totalAmount: number;
  createdAt: { toDate: () => Date };
  companyId: string; // Added for type safety
}
interface ChartData {
  date: string;
  sales: number;
}
const chartConfig = {
  sales: {
    label: 'Sales Amount',
    color: 'var(--chart-1)',
  },
} satisfies ChartConfig;

interface SalesBarChartReportProps {
  isDataVisible: boolean;
}

export function SalesBarChartReport({ isDataVisible }: SalesBarChartReportProps) {
  const { currentUser } = useAuth();
  const { filters } = useFilter();
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSalesData = async () => {
      if (!currentUser?.companyId) {
        setIsLoading(false);
        setError('Company information not found. Please log in again.');
        return;
      }
      if (!filters.startDate || !filters.endDate) {
        setIsLoading(false);
        setChartData([]);
        return;
      }
      setIsLoading(true);
      setError(null);

      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

      const startTimestamp = Timestamp.fromDate(start);
      const endTimestamp = Timestamp.fromDate(end);

      try {
        const salesCollection = collection(db, 'sales');
        const salesQuery = query(
          salesCollection,
          where('companyId', '==', currentUser.companyId),
          where('createdAt', '>=', startTimestamp),
          where('createdAt', '<=', endTimestamp),
          orderBy('createdAt', 'asc'),
        );
        const querySnapshot = await getDocs(salesQuery);
        const fetchedSales: SaleRecord[] = [];
        querySnapshot.forEach((doc) => {
          fetchedSales.push(doc.data() as SaleRecord);
        });

        const salesByDate: { [key: string]: number } = {};
        const currentDate = new Date(start);
        while (currentDate <= end) {
          const dateKey = currentDate.toLocaleDateString('en-CA'); // YYYY-MM-DD format
          salesByDate[dateKey] = 0;
          currentDate.setDate(currentDate.getDate() + 1);
        }

        fetchedSales.forEach((sale) => {
          const date = sale.createdAt.toDate().toLocaleDateString('en-CA');
          if (salesByDate.hasOwnProperty(date)) {
            salesByDate[date] += sale.totalAmount;
          }
        });

        const newChartData: ChartData[] = Object.keys(salesByDate).map((date) => ({
          date,
          sales: salesByDate[date],
        }));

        newChartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setChartData(newChartData);
      } catch (err) {
        console.error('Error fetching sales data:', err);
        if (err instanceof Error && err.message.includes('firestore/failed-precondition')) {
          setError('Database setup required. Please check the developer console for an index creation link.');
        } else {
          setError('Failed to fetch sales data. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchSalesData();
  }, [currentUser, filters]);
  const selectedPeriodText = useMemo(() => {
    if (!filters.startDate || !filters.endDate) {
      return 'for the selected period';
    }
    const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'numeric', year: '2-digit' };
    const startDate = new Date(filters.startDate).toLocaleDateString('en-IN', options);
    const endDate = new Date(filters.endDate).toLocaleDateString('en-IN', options);

    if (startDate === endDate) {
      return `for ${startDate}`;
    }
    return `from ${startDate} to ${endDate}`;
  }, [filters.startDate, filters.endDate]);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Daily Sales Chart</CardTitle>
        <CardDescription>Sales amount  {selectedPeriodText}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? <div className="flex h-[260px] items-center justify-center"><p>Loading Chart...</p></div> :
          error ? <div className="flex h-[260px] items-center justify-center text-center"><p className="text-red-500">{error}</p></div> :
            isDataVisible ? (
              <ChartContainer config={chartConfig} >
                <LineChart accessibilityLayer data={chartData} margin={{ top: 30, left: -15, right: 12, bottom: 10 }}>
                  <CartesianGrid vertical={false} />
                  <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                  <YAxis
                    stroke="#888888"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${value.toLocaleString()}`}
                  />
                  <Line dataKey="sales" type="monotone" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }}>
                  </Line>
                </LineChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[250px] w-full flex-col items-center justify-center rounded-lg bg-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 mb-2"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" x2="22" y1="2" y2="22" /></svg>
                <p className="text-gray-500">Data is hidden</p>
              </div>
            )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Total sales for this period:
          {isDataVisible ? (
            ` ₹${chartData.reduce((sum, data) => sum + data.sales, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
          ) : (' ₹ ******')}
        </div>
      </CardFooter>
    </Card>
  );
}
