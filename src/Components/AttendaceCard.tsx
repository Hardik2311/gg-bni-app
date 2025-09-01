/**
 * Formats a Date object into a readable time string (e.g., "10:30 AM").
 */
const formatTime = (date: Date | null): string => {
    if (!date) return '---';
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

/**
 * Formats the total elapsed seconds into an HH:MM:SS string.
 */
const formatElapsedTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
};


// --- Reusable & Exportable Attendance Card Component ---

interface AttendanceCardProps {
    userName: string;
    status: 'Checked Out' | 'Checked In';
    checkInTime: Date | null;
    checkOutTime: Date | null;
    elapsedTime: number;
    onCheckIn: () => void;
    onCheckOut: () => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
    userName,
    status,
    checkInTime,
    checkOutTime,
    elapsedTime,
    onCheckIn,
    onCheckOut
}) => {
    const isCheckedIn = status === 'Checked In';

    return (
        <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col transition-all hover:shadow-lg w-full max-w-sm">
            {/* User Name and Status Badge */}
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800">{userName}</h2>
                <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${isCheckedIn
                        ? 'bg-green-100 text-green-800'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                >
                    {status}
                </span>
            </div>

            {/* Timestamps Section */}
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

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={onCheckIn}
                    disabled={isCheckedIn}
                    className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg shadow-sm transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    Check In
                </button>
                <button
                    onClick={onCheckOut}
                    disabled={!isCheckedIn}
                    className="w-full py-2 px-4 bg-slate-600 text-white font-semibold rounded-lg shadow-sm transition-colors hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                    Check Out
                </button>
            </div>
        </div>
    );
};


// --- Reusable Attendance Log Card ---

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
            <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">
                Activity Log
            </h3>
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
                            {log.map((entry, index) => (
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