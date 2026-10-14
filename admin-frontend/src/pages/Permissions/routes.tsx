import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { lazyElement } from '@/routes/lazyElement';

const PermissionsLayout = lazy(() => import('./PermissionsLayout'));
const RolesPage = lazy(() => import('./RolesPage'));
const AdminsPage = lazy(() => import('./AdminsPage'));
const MatrixPage = lazy(() => import('./MatrixPage'));

const permissionsRoutes = {
  path: 'permissions',
  element: lazyElement(<PermissionsLayout />),
  children: [
    { index: true, element: <Navigate to="/permissions/roles" replace /> },
    { path: 'roles', element: lazyElement(<RolesPage />) },
    { path: 'admins', element: lazyElement(<AdminsPage />) },
    { path: 'matrix', element: lazyElement(<MatrixPage />) },
    { path: '*', element: <Navigate to="/permissions/roles" replace /> },
  ],
};

export default permissionsRoutes;
