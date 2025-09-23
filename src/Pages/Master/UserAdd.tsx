// src/pages/UserAdd/UserAdd.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ICONS } from '../../constants/icon.constants';
import { ROUTES } from '../../constants/routes.constants';
import { ROLES, Variant } from '../../enums';

// --- CHANGE 1: Assume your useAuth hook and User type are defined something like this ---
// You will import this from your actual auth context file.
import { useAuth } from '../../context/auth-context'; // Example path
import { registerUserWithDetails } from '../../lib/auth_operations';

import { CustomIcon } from '../../Components';
import { FloatingLabelInput } from '../../Components/ui/FloatingLabelInput';
import { CustomButton } from '../../Components/CustomButton';

const UserAdd: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, loading } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ROLES>(ROLES.SALESMAN);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!currentUser?.companyId) {
      setError("Your company information could not be found. Please try logging in again.");
      return;
    }

    if (!fullName.trim() || !email.trim() || !password.trim() || !phoneNumber.trim()) {
      setError("Please fill out all user details.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newUserAuth = await registerUserWithDetails(fullName.trim(), phoneNumber.trim(), email.trim(), password, role);

      const finalUserData = {
        name: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        Email: email.trim(),
        role: role,
        createdAt: serverTimestamp(),
        companyId: currentUser.companyId,
      };

      const docRef = doc(db, 'users', newUserAuth.uid);
      await setDoc(docRef, finalUserData);

      setSuccess(`User "${fullName.trim()}" created successfully!`);

      setTimeout(() => {
        navigate(ROUTES.MASTERS);
      }, 2000);

    } catch (err: any) {
      console.error("User creation failed:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already in use by another account.');
      } else if (err.code === 'auth/weak-password') {
        setError('The password must be at least 6 characters long.');
      } else {
        setError(err.message || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading user data...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white p-6">
      <button
        onClick={() => navigate(ROUTES.HOME)}
        className="self-start mb-8 transition-opacity hover:opacity-75"
        aria-label="Go back"
      >
        <CustomIcon iconName={ICONS.BACK_CURVE} />
      </button>

      <div className="w-full max-w-lg mx-auto">
        <h1 className="text-4xl font-bold mb-6">Add New User</h1>

        <form onSubmit={handleAddUser} className="flex flex-col space-y-6">
          <FloatingLabelInput
            id="fullName"
            type="text"
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            disabled={isSubmitting}
          />
          <FloatingLabelInput
            id="phoneNumber"
            type="tel"
            label="Phone Number"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
            disabled={isSubmitting}
          />
          <FloatingLabelInput
            id="email"
            type="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isSubmitting}
          />
          <FloatingLabelInput
            id="password"
            type="password"
            label="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isSubmitting}
          />

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as ROLES)}
              className="w-full p-3 bg-gray-50 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
              disabled={isSubmitting}
            >
              <option value={ROLES.SALESMAN}>Salesman</option>
              <option value={ROLES.MANAGER}>Manager</option>
            </select>
          </div>

          {error && <p className="text-sm text-center text-red-600 font-medium">{error}</p>}
          {success && <p className="text-sm text-center text-green-600 font-medium">{success}</p>}

          <div className="pt-4">
            <CustomButton type="submit" variant={Variant.Filled} disabled={isSubmitting}>
              {isSubmitting ? 'Adding User...' : 'Add User'}
            </CustomButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserAdd;