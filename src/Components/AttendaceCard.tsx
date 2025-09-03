import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, arrayUnion, increment, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase'; // FIX: Reverted to a direct import for reliability

// --- Helper Functions ---

const formatTime = (date: Date | null): string => {
    if (!date) return '---';
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const formatElapsedTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};


// --- UI Components (Presentational) ---

interface AttendanceCardProps {
    userName: string;
    status: 'Checked Out' | 'Checked In';
    checkInTime: Date | null;
    checkOutTime: Date | null;
    elapsedTime: number;
    onCheckIn: () => void;
    onCheckOut: () => void;
    loading: boolean;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
    userName,
    status,
    checkInTime,
    checkOutTime,
    elapsedTime,
    onCheckIn,
    onCheckOut,
    loading,
}) => {
    const isCheckedIn = status === 'Checked In';

    return (
        <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col transition-all hover:shadow-lg w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">{userName}</h2>
                <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${isCheckedIn
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                >
                    {loading ? 'Loading...' : status}
                </span>
            </div>

            <div className="flex-grow space-y-3 mb-6">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <span className="text-sm font-medium text-slate-500">Checked In At:</span>
                    <span className="text-sm font-semibold text-slate-800">
                        {formatTime(checkInTime)}
                    </span>
                </div>
                <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-blue-600">Duration:</span>
                    <span className="text-sm font-semibold text-blue-800 tabular-nums">
                        {formatElapsedTime(elapsedTime)}
                    </span>
                </div>
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <span className="text-sm font-medium text-slate-500">Checked Out At:</span>
                    <span className="text-sm font-semibold text-slate-800">
                        {formatTime(checkOutTime)}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={onCheckIn}
                    disabled={isCheckedIn || loading}
                    className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    Check In
                </button>
                <button
                    onClick={onCheckOut}
                    disabled={!isCheckedIn || loading}
                    className="w-full py-2 px-4 bg-slate-600 text-white font-semibold rounded-lg shadow-sm transition-colors hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    Check Out
                </button>
            </div>
        </div>
    );
};

interface LogEntry {
    checkIn: Date;
    checkOut: Date | null;
}

interface AttendanceLogCardProps {
    log: LogEntry[];
}

export const AttendanceLogCard: React.FC<AttendanceLogCardProps> = ({ log }) => {
    return (
        <div className="bg-white rounded-2xl shadow-md p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Activity Log</h3>
            <div className="max-h-48 overflow-y-auto">
                {log.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No activity recorded yet.</p>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase">
                            <tr>
                                <th className="py-2 px-2">Check In</th>
                                <th className="py-2 px-2">Check Out</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...log].reverse().map((entry, index) => (
                                <tr key={index} className="border-b last:border-0">
                                    <td className="py-2 px-2 font-medium text-slate-700">{formatTime(entry.checkIn)}</td>
                                    <td className="py-2 px-2 font-medium text-slate-700">{formatTime(entry.checkOut)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

// --- Custom Hook for All Attendance Logic ---

interface UseAttendanceReturn {
    status: 'Checked In' | 'Checked Out';
    checkInTime: Date | null;
    checkOutTime: Date | null;
    elapsedTime: number;
    log: LogEntry[];
    loading: boolean;
    handleCheckIn: () => Promise<void>;
    handleCheckOut: () => Promise<void>;
}

export const useAttendance = (userId?: string): UseAttendanceReturn => {
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState<'Checked In' | 'Checked Out'>('Checked Out');
    const [checkInTime, setCheckInTime] = useState<Date | null>(null);
    const [checkOutTime, setCheckOutTime] = useState<Date | null>(null);
    const [elapsedTime, setElapsedTime] = useState<number>(0);
    const [log, setLog] = useState<LogEntry[]>([]);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const docRef = doc(db, 'attendance', `${userId}_${today}`);
        let timerId: NodeJS.Timeout | undefined;

        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            setLoading(true);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const serverStatus = data.status || 'Checked Out';
                const lastCheckIn = data.lastCheckInTime instanceof Timestamp ? data.lastCheckInTime.toDate() : null;
                let liveElapsedTime = data.totalElapsedTime || 0;

                setStatus(serverStatus);

                const currentLog = data.log?.map((l: any) => ({
                    checkIn: l.checkIn instanceof Timestamp ? l.checkIn.toDate() : new Date(),
                    checkOut: l.checkOut instanceof Timestamp ? l.checkOut.toDate() : null,
                })) || [];
                setLog(currentLog);

                const lastLogEntry = currentLog[currentLog.length - 1];
                if (lastLogEntry) {
                    setCheckInTime(lastLogEntry.checkIn);
                    setCheckOutTime(lastLogEntry.checkOut);
                }

                if (serverStatus === 'Checked In' && lastCheckIn) {
                    const sessionSeconds = Math.floor((Date.now() - lastCheckIn.getTime()) / 1000);
                    liveElapsedTime += sessionSeconds;
                }
                setElapsedTime(liveElapsedTime);

            } else {
                setStatus('Checked Out');
                setCheckInTime(null);
                setCheckOutTime(null);
                setElapsedTime(0);
                setLog([]);
            }
            setLoading(false);
        }, (error) => {
            console.error("Attendance snapshot error:", error);
            setLoading(false);
        });

        // This client-side timer just ticks the seconds display up
        if (status === 'Checked In') {
            timerId = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        }

        return () => {
            unsubscribe();
            if (timerId) clearInterval(timerId);
        };
    }, [userId, status]);

    const handleCheckIn = async () => {
        if (!userId) return;
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const docRef = doc(db, 'attendance', `${userId}_${today}`);

        try {
            const docSnap = await getDoc(docRef);
            const newLogEntry = { checkIn: serverTimestamp(), checkOut: null };

            if (!docSnap.exists()) {
                await setDoc(docRef, {
                    userId,
                    date: today,
                    status: 'Checked In',
                    lastCheckInTime: serverTimestamp(),
                    totalElapsedTime: 0,
                    log: [newLogEntry],
                });
            } else {
                // FIX: Use arrayUnion for safer updates
                await updateDoc(docRef, {
                    status: 'Checked In',
                    lastCheckInTime: serverTimestamp(),
                    log: arrayUnion(newLogEntry),
                });
            }
        } catch (error) {
            console.error("Error checking in:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCheckOut = async () => {
        if (!userId) return;
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];
        const docRef = doc(db, 'attendance', `${userId}_${today}`);

        try {
            const docSnap = await getDoc(docRef);
            if (!docSnap.exists() || docSnap.data().status !== 'Checked In') {
                setLoading(false);
                return;
            }

            const data = docSnap.data();
            const lastCheckInTime = data.lastCheckInTime?.toDate();
            if (!lastCheckInTime) {
                setLoading(false);
                return;
            }

            const sessionSeconds = Math.floor((Date.now() - lastCheckInTime.getTime()) / 1000);

            // FIX: More robust log update
            const updatedLog = data.log.map((entry: any, index: number) => {
                if (index === data.log.length - 1 && entry.checkOut === null) {
                    return { ...entry, checkOut: serverTimestamp() };
                }
                return entry;
            });

            await updateDoc(docRef, {
                status: 'Checked Out',
                totalElapsedTime: increment(sessionSeconds),
                log: updatedLog,
            });
        } catch (error) {
            console.error("Error checking out:", error);
        } finally {
            setLoading(false);
        }
    };

    return { status, checkInTime, checkOutTime, elapsedTime, log, loading, handleCheckIn, handleCheckOut };
};

