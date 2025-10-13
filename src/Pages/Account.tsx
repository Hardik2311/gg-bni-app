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
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header and User Info Section */}
      <div className="relative flex flex-col items-center bg-gray-100 px-1 py-5">
        <div className="mt-2 relative mb-4">
          <img
            className="h-32 w-32 rounded-full object-cover border-4 border-white shadow-lg"
            src="https://github.com/shadcn.png"
            alt="Profile"
          />
          <div className="absolute top-0 left-0 right-0 bottom-0 border-2 border-green-500 rounded-full animate-pulse"></div>
        </div>

        <h2 className="mb-1 text-2xl font-semibold text-slate-900">
          {profileData.name}
        </h2>
        <p className="mb-6 text-base text-gray-400">
          {profileData.email}
        </p>

        {/* Buttons: Edit Profile, Logout */}
        <div className="flex flex-wrap justify-center gap-4 px-4">
          <button
            onClick={handleEditProfile}
            className="rounded-full bg-gray-200 py-3 px-8 font-semibold text-gray-800 transition hover:bg-gray-300"
          >
            Edit Profile
          </button>
          <button
            onClick={handleLogout}
            className="rounded-full bg-red-500 py-3 px-8 font-semibold text-white transition hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Share Your Business Card Section */}
      <div className="flex-1 bg-gray-100 p-2 ">
        <div className="w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-slate-800">
              Business card
            </h2>
            <button className="bg-gray-200 text-gray-800 px-4 py-2 rounded-full shadow-sm text-sm font-semibold">
              Share
            </button>
          </div>
          <div className="mb-8 flex gap-5 overflow-x-auto pb-4 px-1">
            {/* Template 1 */}
            <div className="flex-shrink-0 w-36 rounded-lg bg-white p-4 text-center shadow-sm border border-gray-200">
              <img
                src="https://placehold.co/600x400/E2E8F0/475569?text=Template+1"
                alt="Business Card Template 1"
                className="mb-3 block h-auto w-full rounded"
              />
              <p className="font-semibold text-slate-600">Template 1</p>
            </div>
            {/* Template 2 */}
            <div className="flex-shrink-0 w-36 rounded-lg bg-white p-4 text-center shadow-sm border border-gray-200">
              <img
                src="https://placehold.co/600x400/E2E8F0/475569?text=Template+2"
                alt="Business Card Template 2"
                className="mb-3 block h-auto w-full rounded"
              />
              <p className="font-semibold text-slate-600">Template 2</p>
            </div>
            {/* Template 3 */}
            <div className="flex-shrink-0 w-36 rounded-lg bg-white p-4 text-center shadow-sm border border-gray-200">
              <img
                src="https://placehold.co/600x400/E2E8F0/475569?text=Template+3"
                alt="Business Card Template 3"
                className="mb-3 block h-auto w-full rounded"
              />
              <p className="font-semibold text-slate-600">Template 3</p>
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
                bg-white p-4 rounded-xl shadow-md mb-2
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
                bg-white p-4 rounded-xl shadow-md mb-2
                border border-gray-200 text-gray-800
                hover:shadow-lg
              "
              >
                <span className="text-lg font-medium">Setting</span>
                <span className="text-xl text-gray-600">→</span>
              </Link>
            </PermissionWrapper>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
