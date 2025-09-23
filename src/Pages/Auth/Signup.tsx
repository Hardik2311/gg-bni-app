import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { ROUTES } from '../../constants/routes.constants';
import { registerUserWithDetails } from '../../lib/auth_operations';

import { CustomIcon } from '../../Components';
import { ICONS } from '../../constants/icon.constants';
import { CustomButton } from '../../Components/CustomButton';
import { FloatingLabelInput } from '../../Components/ui/FloatingLabelInput';
import { ROLES, Variant } from '../../enums';

const OwnerInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const combinedData = location.state;

  const [ownerName, setOwnerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ownerName.trim() || !email.trim() || !password.trim()) {
      setError("Please fill out all owner details.");
      return;
    }

    setIsSubmitting(true);

    try {
      const user = await registerUserWithDetails(ownerName, phoneNumber, email, password, ROLES.OWNER);

      const finalBusinessData = {
        ...combinedData,
        ownerUID: user.uid,
        ownerName: ownerName,
        phoneNumber: phoneNumber,
        ownerEmail: email,
        createdAt: serverTimestamp(),
      };

      const docRef = doc(db, 'business_info', user.uid);
      await setDoc(docRef, finalBusinessData);

      navigate(ROUTES.HOME);

    } catch (err: any) {
      console.error("Registration failed:", err);
      setError(err.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6">
      <button
        onClick={() => navigate(-1)}
        className="self-start mb-8"
      >
        <CustomIcon iconName={ICONS.BACK_CURVE} />
      </button>
      <h1 className="text-4xl font-bold mb-2">Owner Information</h1>

      <form onSubmit={handleFinish} className="flex flex-col space-y-6 overflow-y-auto">
        <FloatingLabelInput
          id="ownerName"
          type="text"
          label="Your Full Name"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          required
        />
        <FloatingLabelInput
          id="phoneNumber"
          type="number"
          label="Your Phone Number"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          required
        />
        <FloatingLabelInput
          id="email"
          type="email"
          label="Email Address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <FloatingLabelInput
          id="password"
          type="password"
          label="Create a Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <CustomButton type="submit" variant={Variant.Filled} disabled={isSubmitting}>
          {isSubmitting ? 'Signing Up...' : 'Sign Up'}
        </CustomButton>
      </form>
    </div>
  );
};

export default OwnerInfoPage;
