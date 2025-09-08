import React from 'react';
import { useAuth } from '../context/auth-context'; // Or your new hook path
import Loading from '../Pages/Loading/Loading';
import AccessDeniedPage from '../Pages/Unauthorized';
import { Permissions } from '../enums';

interface WrapperProps {
    children: React.ReactNode;
    requiredPermission: Permissions;
    // FIX: Add an optional 'behavior' prop
    behavior?: 'showPage' | 'hide';
}

const PermissionWrapper = ({ children, requiredPermission, behavior = 'showPage' }: WrapperProps) => {
    const { currentUser, loading, hasPermission } = useAuth();

    if (loading) {
        return <Loading />;
    }

    // FIX: Use the 'behavior' prop to decide what to do on failure
    if (!currentUser || !hasPermission(requiredPermission)) {
        // If behavior is 'showPage' (default), show the full page.
        // If behavior is 'hide', render nothing (null).
        return behavior === 'showPage' ? <AccessDeniedPage /> : null;
    }

    // If permission is granted, render the children as normal.
    return <>{children}</>;
};

export default PermissionWrapper;