import { State } from "../enums";

interface ModalProps {
    message: string;
    onClose: () => void;
    onConfirm?: () => void;
    showConfirmButton?: boolean;
    type: State;
}

export const Modal: React.FC<ModalProps> = ({
    message,
    onClose,
    onConfirm,
    // Set a default value for showConfirmButton to make it optional
    showConfirmButton = false,
    type,
}) => (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center">
            {/* Icon based on type */}
            <div className={`mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center ${type === State.SUCCESS ? 'bg-green-100' :
                    type === State.ERROR ? 'bg-red-100' :
                        'bg-blue-100'
                }`}>
                {type === State.SUCCESS && <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>}
                {type === State.ERROR && <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>}
                {type === State.INFO && <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>}
            </div>

            <p className="text-lg font-medium text-gray-800 mb-6">{message}</p>

            {/* Conditionally render buttons based on showConfirmButton prop */}
            {showConfirmButton ? (
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 text-white py-2 px-4 rounded-lg transition-colors ${type === State.ERROR || type === State.INFO ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        Confirm
                    </button>
                </div>
            ) : (
                <button
                    onClick={onClose}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                >
                    OK
                </button>
            )}
        </div>
    </div>
);