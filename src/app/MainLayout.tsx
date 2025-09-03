import { Suspense } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Button } from '../Components/ui/button';
import { navItems } from '../routes/bottomRoutes';
import { FloatingButton } from '../Components/FloatingButton';
import { ROUTES } from '../constants/routes.constants';
import { useNavigate } from 'react-router-dom';
import { Permissions } from '../enums';
import PermissionWrapper from '../context/PermissionWrapper';

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <>
      <main style={{ padding: '1rem', paddingBottom: '60px' }}>
        <Suspense fallback={<div>Loading...</div>}>
          <Outlet />
        </Suspense>
      </main>

      <FloatingButton className="">
        <Button
          variant="outline"
          className="w-full mb-2 rounded"
          onClick={() => navigate(`${ROUTES.SALES}`)}
        >
          Add Sales
        </Button>
        <PermissionWrapper
          requiredPermission={Permissions.ViewTransactions}
          behavior="hide"
        >
          <Button
            variant="outline"
            className="w-full mb-2 rounded"
            onClick={() => navigate(`${ROUTES.PURCHASE}`)}
          >
            Add Purchase
          </Button>
        </PermissionWrapper>
        <PermissionWrapper
          requiredPermission={Permissions.ViewTransactions}
          behavior="hide"
        >
          <Button
            variant="outline"
            className="w-full mb-2 rounded"
            onClick={() => navigate(`${ROUTES.PAYMENT}`)}
          >
            Add Payments
          </Button>
        </PermissionWrapper>
        <PermissionWrapper
          requiredPermission={Permissions.ViewTransactions}
          behavior="hide"
        >
          <Button
            variant="outline"
            className="w-full mb-2 rounded"
            onClick={() => navigate(`${ROUTES.ITEM_ADD}`)}
          >
            Add Item
          </Button>
        </PermissionWrapper>
        <PermissionWrapper
          requiredPermission={Permissions.ViewPNLReport}
          behavior="hide"
        >
          <Button
            variant="outline"
            className="w-full mb-2 rounded"
            onClick={() => navigate(`${ROUTES.USER_ADD}`)}
          >
            Add User
          </Button>
        </PermissionWrapper>
      </FloatingButton>

      <nav className="fixed bottom-0 left-0 w-full border-t border-slate-200 bg-white">
        <div className="flex justify-around items-center px-4 pt-2 pb-3">
          {navItems.map(({ to, icon, label }) => (
            <Link
              key={to}
              to={to}
              className={`flex-1 flex flex-row items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors duration-200 ${location.pathname === to ? 'bg-sky-100 text-sky-600' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <div>{icon}</div>
              <span className="font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
};

export default MainLayout;
