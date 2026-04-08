import { Navigate } from 'react-router-dom';
import PermissionsLayout from './PermissionsLayout';
import RolesPage from './RolesPage';
import AdminsPage from './AdminsPage';
import MatrixPage from './MatrixPage';

const permissionsRoutes = {
  path: 'permissions',
  element: <PermissionsLayout />,
  children: [
    { index: true, element: <Navigate to="/permissions/roles" replace /> },
    { path: 'roles', element: <RolesPage /> },
    { path: 'admins', element: <AdminsPage /> },
    { path: 'matrix', element: <MatrixPage /> },
    { path: '*', element: <Navigate to="/permissions/roles" replace /> },
  ],
};

export default permissionsRoutes;
