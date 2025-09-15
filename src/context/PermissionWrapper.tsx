import React from 'react';
import { useAuth } from '../context/auth-context';
import AccessDeniedPage from '../Pages/Unauthorized';
import { Permissions } from '../enums';
import { Navigate, Outlet } from 'react-router-dom';
import { ROUTES } from '../constants/routes.constants';

interface WrapperProps {
    children: React.ReactNode;
    requiredPermission: Permissions;
    behavior?: 'showPage' | 'hide';
}

const PermissionWrapper = ({ children, requiredPermission, behavior = 'showPage' }: WrapperProps) => {
    // FIX: The 'loading' state is no longer needed here.
    const { currentUser, hasPermission } = useAuth();
    const redirectPath = ROUTES.LANDING;


    if (!currentUser) {
        return <Navigate to={redirectPath} replace />;
    }

    if (!hasPermission(requiredPermission)) {
        return behavior === 'showPage' ? <AccessDeniedPage /> : null;
    }

    return <>{children}</>;
}

export default PermissionWrapper;

export const PublicRoute: React.FC = () => {
    const { currentUser } = useAuth();
    const redirectPath = ROUTES.HOME;

    if (currentUser) {

        return <Navigate to={redirectPath} replace />;
    }

    return <Outlet />; // Renders the child route (e.g., Login page)
};