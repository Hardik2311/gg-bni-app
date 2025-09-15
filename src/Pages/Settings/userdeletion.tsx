// import React, { useState, useEffect } from 'react';
// import { collection, onSnapshot } from 'firebase/firestore';
// import { db } from '../../lib/firebase';
// import { useAuth } from '../../context/auth-context';
// import { deleteCurrentUserAccount } from '../../lib/auth_operations';
// // Define the shape of a user object from Firestore
// interface UserProfile {
//     id: string; // The document ID (which is the user's UID)
//     name: string;
//     email: string;
//     role: string;
// }

// // Custom hook to fetch all users from the 'users' collection
// const useAllUsers = () => {
//     const [users, setUsers] = useState<UserProfile[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [error, setError] = useState<string | null>(null);

//     useEffect(() => {
//         const usersCollectionRef = collection(db, 'users');

//         // Use onSnapshot for real-time updates
//         const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
//             const usersList = snapshot.docs.map(doc => ({
//                 id: doc.id,
//                 ...doc.data(),
//             } as UserProfile));
//             setUsers(usersList);
//             setLoading(false);
//         }, (err) => {
//             console.error("Failed to fetch users:", err);
//             setError('Failed to load user data.');
//             setLoading(false);
//         });

//         // Clean up the listener when the component unmounts
//         return () => unsubscribe();
//     }, []);

//     return { users, loading, error };
// };


// const UserListPage: React.FC = () => {
//     const { currentUser } = useAuth();
//     const { users, loading: usersLoading, error: usersError } = useAllUsers();

//     const [actionError, setActionError] = useState<string | null>(null);

//     const handleDeleteUser = async (userId: string, userName: string) => {
//         setActionError(null);

//         // Prevent an admin from deleting themselves
//         if (currentUser?.uid === userId) {
//             setActionError("For security, you cannot delete your own account from this panel.");
//             return;
//         }

//         if (window.confirm(`Are you sure you want to permanently delete "${userName}"? This will remove their authentication record and Firestore data.`)) {
//             try {
//                 const result = await deleteCurrentUserAccount();
//                 alert(result); // Show success message
//             } catch (err: any) {
//                 setActionError(err.message);
//             }
//         }
//     };

//     if (usersLoading) {
//         return <div className="p-6 text-center">Loading user list...</div>;
//     }

//     return (
//         // This entire page should be protected by your PermissionWrapper in your router
//         // Example: <PermissionWrapper requiredPermission={Permissions.MANAGE_USERS}><UserListPage /></PermissionWrapper>
//         <div className="p-4 sm:p-6">
//             <h1 className="text-2xl font-bold text-slate-800 mb-4">Manage Users</h1>

//             {usersError && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{usersError}</p>}
//             {actionError && <p className="text-red-500 bg-red-100 p-3 rounded-md mb-4">{actionError}</p>}

//             <div className="bg-white rounded-lg shadow-md overflow-hidden">
//                 <div className="overflow-x-auto">
//                     <table className="min-w-full divide-y divide-gray-200">
//                         <thead className="bg-slate-50">
//                             <tr>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Email</th>
//                                 <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Role</th>
//                                 <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
//                             </tr>
//                         </thead>
//                         <tbody className="bg-white divide-y divide-gray-200">
//                             {users.map(user => (
//                                 <tr key={user.id}>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.name}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{user.role}</td>
//                                     <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
//                                         <button
//                                             onClick={() => handleDeleteUser(user.id, user.name)}
//                                             className="text-red-600 hover:text-red-800 transition-colors"
//                                             // Disable the button for the currently logged-in admin
//                                             disabled={currentUser?.uid === user.id}
//                                         >
//                                             Delete
//                                         </button>
//                                     </td>
//                                 </tr>
//                             ))}
//                         </tbody>
//                     </table>
//                 </div>
//             </div>
//         </div>
//     );
// };

// export default UserListPage;

