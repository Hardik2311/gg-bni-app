import React from 'react';
import { useAuth } from '../context/auth-context'; // Or your new hook path
import Loading from '../Pages/Loading/Loading';
import AccessDeniedPage from '../Pages/Unauthorized';
import { Permissions } from '../enums';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.constants';

interface WrapperProps {
    children: React.ReactNode;
    requiredPermission: Permissions;
    behavior?: 'showPage' | 'hide';
}

const PermissionWrapper = ({ children, requiredPermission, behavior = 'showPage' }: WrapperProps) => {
    const { currentUser, loading, hasPermission } = useAuth();
    let redirectPath = ROUTES.LANDING;

    if (loading) {
        return <Loading />;
    }
    if (!currentUser) {
        return <Navigate to={redirectPath} replace />;
    }
    else if (!hasPermission(requiredPermission)) {
        return behavior === 'showPage' ? <AccessDeniedPage /> : null;
    };

    return <>{children}</>;
}
export default PermissionWrapper;