import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import MainLayout from '../app/MainLayout';
import { ROUTES } from '../constants/routes.constants';
import {AuthProvider} from '../context/Authcontext'; // Import AuthProvider
import ProtectedRoute from '../constants/ProtectedRoutes';
// Lazy load all the page components
const Home = lazy(() => import('../Pages/Home'));
const Account = lazy(() => import('../Pages/Account'));
const Journal = lazy(() => import('../Pages/Journal'));
const Reports = lazy(() => import('../Pages/Reports'));
const Masters = lazy(() => import('../Pages/Masters'));
const Sales = lazy(() => import('../Pages/Master/Sales'));
const SalesReturn = lazy(() => import('../Pages/Master/SalesReturn'));
const Purchase = lazy(() => import('../Pages/Master/Purchase'));
const PurchaseReturn = lazy(() => import('../Pages/Master/PurchaseReturn'));
const ItemAdd = lazy(() => import('../Pages/Master/ItemAdd'));
const ItemGroup = lazy(() => import('../Pages/Master/ItemGroup'));
const UserAdd = lazy(() => import('../Pages/Master/UserAdd'));
const Payment = lazy(() => import('../Pages/Master/Payment'));
const Login = lazy(() => import('../Pages/Auth/Login'));
const Signup = lazy(() => import('../Pages/Auth/Signup'));
const EditProfile = lazy(() => import('../Pages/Account/EditProfile'));
const router = createBrowserRouter([
  {
    path: ROUTES.HOME,
    element: (
      <ProtectedRoute>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: ROUTES.ACCOUNT.substring(1), element: <Account />,
        children: [
          { index: true, element: <Account /> },
        { path: ROUTES.EDIT_PROFILE.substring(1), element: <EditProfile /> },
      ]},
      { path: ROUTES.JOURNAL.substring(1), element: <Journal /> },
      {
        path: ROUTES.MASTERS,
        element: <Masters />,
        children: [
          { index: true, element: <Masters /> },
          { path: ROUTES.SALES, element: <Sales /> },
          { path: ROUTES.SALES_RETURN, element: <SalesReturn /> },
          { path: ROUTES.PURCHASE, element: <Purchase /> },
          { path: ROUTES.PURCHASE_RETURN, element: <PurchaseReturn /> },
          { path: ROUTES.ITEM_ADD, element: <ItemAdd /> },
          { path: ROUTES.ITEM_GROUP, element: <ItemGroup /> },
          { path: ROUTES.USER_ADD, element: <UserAdd /> },
          { path: ROUTES.PAYMENT, element: <Payment /> },
        ],
      },
      { path: ROUTES.REPORTS.substring(1), element: <Reports /> },
    ],
  },
   {
    path: ROUTES.LOGIN, 
    element: <Login />,
  },
  {
    path: ROUTES.SIGNUP,
    element: <Signup />,
  },
]);
const AppRouter: React.FC = () => {
    return (
        <AuthProvider>
            <Suspense fallback={<div>Loading app...</div>}> {/* Suspense for lazy loading */}
                <RouterProvider router={router} />
            </Suspense>
        </AuthProvider>
    );
};

export default AppRouter;
