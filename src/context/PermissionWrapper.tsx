import React from 'react';
import { useAuth } from '../context/auth-context';
import AccessDeniedPage from '../Pages/Unauthorized';
import { Permissions } from '../enums';
import { Navigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes.constants';

interface WrapperProps {
    children: React.ReactNode;
    requiredPermission?: Permissions;
    behavior?: 'showPage' | 'hide';
    isPublic?: boolean;
}

const PermissionWrapper = ({ children, requiredPermission, behavior = 'showPage', isPublic = false }: WrapperProps) => {
    const { currentUser, hasPermission } = useAuth();
    const redirectPath = ROUTES.LANDING;

    if (isPublic) {
        return currentUser ? <Navigate to={ROUTES.HOME} replace /> : <>{children}</>;
    }

    if (!currentUser) {
        return <Navigate to={redirectPath} replace />;
    }

    if (requiredPermission && !hasPermission(requiredPermission)) {
        return behavior === 'showPage' ? <AccessDeniedPage /> : null;
    }

    return <>{children}</>;
}

export default PermissionWrapper;
