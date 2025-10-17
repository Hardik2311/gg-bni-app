import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Import Outlet
import { useAuth } from '../context/auth-context'; // Import useAuth hook
import { logoutUser } from '../lib/auth_operations'; // Import logout function
import { db } from '../lib/firebase'; // Import Firestore database instance
import { doc, getDoc } from 'firebase/firestore';
import { ROUTES } from '../constants/routes.constants'; // Import routes for navigation
import { Permissions } from '../enums'; // Import Permissions enum
import PermissionWrapper from '../context/PermissionWrapper'; // Import PermissionWrapper

// Define a type for the user profile data
interface UserProfile {
  name: string;
  email: string;
  // Add other fields from your Firestore user document here
}

const Account: React.FC = () => {
  const navigate = useNavigate();

  const { currentUser, loading: loadingAuth } = useAuth(); // Get user and auth loading state
  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // useEffect to fetch user data from Firestore
  useEffect(() => {
    const fetchUserProfile = async () => {
      // First, check if auth state is still loading or no user is logged in
      if (loadingAuth) {
        return;
      }
      if (!currentUser) {
        setLoadingProfile(false);
        setError('No user is currently logged in.');
        navigate(ROUTES.LOGIN); // Redirect to login if currentUser is null
        return;
      }

      setLoadingProfile(true);
      setError(null);

      try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          setProfileData(userDocSnap.data() as UserProfile);
        } else {
          setError('User profile not found in Firestore.');
        }
      } catch (err) {
        console.error('Failed to fetch user profile:', err);
        setError('Failed to fetch user data. Please try again.');
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [currentUser, loadingAuth, navigate]); // Rerun effect when auth state changes

  // Function to handle logout logic
  const handleLogout = async () => {
    try {
      await logoutUser(); // Call the imported logout function
      navigate(ROUTES.LANDING); // Redirect to the landing page
    } catch (err) {
      console.error('Logout failed:', err);
      // You can add a user-facing alert here
    }
  };

  // Function to handle edit profile
  const handleEditProfile = () => {
    // Navigate to the nested edit profile route
    navigate(`${ROUTES.EDIT_PROFILE}`);
  };

  // Conditional rendering for different states
  if (loadingAuth || loadingProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-500">
        <p>Loading profile data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-red-500">
        <p>No profile data available.</p>
      </div>
    );
  }

  // Render the actual content once data is loaded
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* --- MODIFIED HEADER SECTION STARTS HERE --- */}
      <div className="bg-gray-100 p-6 pb-4 border-b border-gray-300">
        <h1 className="text-4xl text-center font-bold text-slate-800 mb-4">Account</h1>

        {/* Centered Profile Info */}
        <div className="flex flex-col items-center">
          {/* Profile Picture with Settings Gear */}
          <div className="relative mb-4">
            {/* Your Original Profile Picture */}
            <img
              className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
              src="https://github.com/shadcn.png"
              alt="Profile"
            />
            {/* Your Original Pulsing Border */}
            <div className="absolute top-0 left-0 right-0 bottom-0 border-2 border-green-500 rounded-full animate-pulse"></div>

            {/* Settings Gear Button */}
            <button
              onClick={handleEditProfile}
              className="absolute -top-1 -right-1 bg-white p-1.5 rounded-full shadow-lg hover:bg-gray-200 transition focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-6 h-6 text-gray-700"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.424.35.534.954.26 1.431l-1.296 2.247a1.125 1.125 0 01-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.941l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 01-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 01-1.37-.49l-1.296-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 01-.26-1.431l1.296-2.247a1.125 1.125 0 011.37-.49l1.217.456c.355.133.75.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.213-1.28z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>

          {/* Name and Email */}
          <h2 className="text-2xl font-semibold text-slate-900">
            {profileData.name}
          </h2>
          <p className="text-base text-gray-500">{profileData.email}</p>
        </div>
      </div>

      {/* Share Your Business Card Section */}
      <div className="flex-1 bg-gray-100 p-2">
        <div className="w-full">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            Share your Business Card
          </h2>
          {/* Scrollable Container */}
          <div className="flex space-x-4 overflow-x-auto pb-4 mb-4">
            {/* Business Card 1 */}
            <div className="flex-shrink-0 w-40 bg-white rounded-sm shadow p-4 h-32 flex flex-col justify-between">
              <p className="font-semibold text-gray-800">Business Card 1</p>
              <button className="self-end focus:outline-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600 hover:text-gray-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                  />
                </svg>
              </button>
            </div>

            {/* Business Card 2 */}
            <div className="flex-shrink-0 w-40 bg-white rounded-sm shadow p-4 h-32 flex flex-col justify-between">
              <p className="font-semibold text-gray-800">Business Card 2</p>
              <button className="self-end focus:outline-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600 hover:text-gray-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                  />
                </svg>
              </button>
            </div>

            {/* Business Card 3 */}
            <div className="flex-shrink-0 w-40 bg-white rounded-sm shadow p-4 h-32 flex flex-col justify-between">
              <p className="font-semibold text-gray-800">Business Card 3</p>
              <button className="self-end focus:outline-none">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-600 hover:text-gray-900"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.684 13.342C8.886 12.938 9 12.482 9 12s-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                  />
                </svg>
              </button>
            </div>
          </div>
          <div className="w-full flex grid grid-cols-2 gap-4 justify-center mt-2 space-y-2 flex-col">

            <PermissionWrapper
              requiredPermission={Permissions.ViewPNLReport}
              behavior="hide"
            >
              <Link
                to={ROUTES.REPORTS}
                className="
                flex justify-between items-center
                bg-white p-4 rounded-sm shadow-md mb-2
                border border-gray-200 text-gray-800
                hover:shadow-lg
              "
              >
                <span className="text-lg font-medium">Reports</span>
                <span className="text-xl text-gray-600">→</span>
              </Link>
              <Link
                to={ROUTES.MASTERS}
                className="
                flex justify-between items-center
                bg-white p-4 rounded-sm shadow-md mb-2
                border border-gray-200 text-gray-800
                hover:shadow-lg
              "
              >
                <span className="text-lg font-medium">Setting</span>
                <span className="text-xl text-gray-600">→</span>
              </Link>
            </PermissionWrapper>
          </div>
          <div className="mt-2 flex justify-center">
            <button
              onClick={handleLogout}
              className="rounded-sm bg-red-500 py-3 px-8 font-semibold text-white transition hover:bg-red-600"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </div >
  );
};

export default Account;
