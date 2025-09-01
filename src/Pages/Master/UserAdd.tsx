import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Assuming these imports are correct for your project structure
import { ICONS } from '../../constants/icon.constants';
import { CustomIcon } from '../../Components';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ROUTES } from '../../constants/routes.constants';
import { FloatingLabelInput } from '../../Components/ui/FloatingLabelInput';
import { CustomButton } from '../../Components/CustomButton';
import { registerUserWithDetails } from '../../lib/auth_operations';
import { Variant, ROLES } from '../../enums';

const UserAdd: React.FC = () => {
  const navigate = useNavigate();

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

    if (!fullName.trim() || !email.trim() || !password.trim() || !phoneNumber.trim()) {
      setError("Please fill out all user details.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create the user account using your custom helper function.
      const user = await registerUserWithDetails(fullName.trim(), phoneNumber.trim(), email.trim(), password, role);

      // Step 2: Prepare the final document for Firestore.
      const finalBusinessData = {
        name: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        Email: email.trim(),
        role: role,
        createdAt: serverTimestamp(),
      };

      // Step 3: Save the complete profile to the 'users' collection in Firestore.
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, finalBusinessData);

      setSuccess(`User "${fullName}" created successfully!`);

      // Step 4: Navigate to the main page on success after a short delay.
      setTimeout(() => {
        navigate(ROUTES.MASTERS);
      }, 2000);

    } catch (err: any) {
      console.error("User creation and registration failed:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6">
      <button
        onClick={() => navigate(ROUTES.HOME)}
        className="self-start mb-8"
      >
        <CustomIcon iconName={ICONS.BACK_CURVE} />
      </button>
      <h1 className="text-4xl font-bold mb-2">User Add</h1>

      <form onSubmit={handleAddUser} className="flex flex-col p-6 space-y-6 overflow-y-auto">
        <FloatingLabelInput
          id="fullName"
          type="text"
          label="Full Name"
          value={fullName}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
          required
          disabled={isSubmitting}
        />
        <FloatingLabelInput
          id="phoneNumber"
          type="tel"
          label="Phone Number"
          value={phoneNumber}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhoneNumber(e.target.value)}
          required
          disabled={isSubmitting}
        />
        <FloatingLabelInput
          id="email"
          type="email"
          label="Email"
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
          required
          disabled={isSubmitting}
        />
        <FloatingLabelInput
          id="password"
          type="password"
          label="Password"
          value={password}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
          required
          disabled={isSubmitting}
        />

        <div className="relative">
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as ROLES)}
            className="w-full p-3 bg-gray-50 rounded-md border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
            disabled={isSubmitting}
          >
            <option value={ROLES.SALESMAN}>Salesman</option>
            <option value={ROLES.MANAGER}>Manager</option>
          </select>
        </div>

        {error && <p className="text-sm text-center text-red-600">{error}</p>}
        {success && <p className="text-sm text-center text-green-600">{success}</p>}

        <CustomButton type="submit" variant={Variant.Filled} disabled={isSubmitting}>
          {isSubmitting ? 'Adding User...' : 'Add User'}
        </CustomButton>
      </form>
    </div>
  );
};

export default UserAdd;