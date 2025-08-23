import React from 'react';
import { useAuth } from '../context/auth-context'; // Or your new hook path
// import { hasPermission } from '../Role/permissions'; // Or the one from your context
import { Permissions } from '../enums/permissions.enum';
import Loading from '../Pages/Loading/Loading';// An explicit access denied page
import { Home } from '../Pages';

const PermissionWrapper = ({ children, requiredPermission }: { children: React.ReactNode, requiredPermission: Permissions }) => {
    const { currentUser, loading } = useAuth();

    // --- ADD THESE LOGS ---
    console.log("--- PermissionWrapper Check ---");
    console.log("Loading State:", loading);
    console.log("Current User:", currentUser);
    console.log("Required Permission:", requiredPermission);
    // Assuming your useAuth hook provides the hasPermission function
    // console.log("Does user have permission?:", hasPermission(requiredPermission)); 
    console.log("-----------------------------");

    if (loading) {
        return <Loading />;
    }

    // This logic needs to use the hasPermission from your context
    // For now, let's assume it's checking currentUser.permissions
    if (!currentUser || !currentUser.permissions.includes(requiredPermission)) {
        return <Home />;
    }

    return <>{children}</>;
};

export default PermissionWrapper;