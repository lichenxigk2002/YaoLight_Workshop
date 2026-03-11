import { createBrowserRouter } from 'react-router-dom';
import AdminGuard from '@/guards/AdminGuard';
import AdminLayout from '@/layouts/AdminLayout';
import billingRoutes from '@/pages/Billing/routes';
import CrawlerRulesPage from '@/pages/CrawlerRules';
import DashboardPage from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';
import NodeTypesPage from '@/pages/NodeTypes';
import NotFoundPage from '@/pages/NotFound';
import OperationLogsPage from '@/pages/OperationLogs';
import PermissionsPage from '@/pages/Permissions';
import SystemConfigsPage from '@/pages/SystemConfigs';
import UsersPage from '@/pages/Users';
import WorkflowTemplatesPage from '@/pages/WorkflowTemplates';
import aiAdminRoutes from '@/pages/AIModels/routes';
import notificationsRoutes from '@/pages/Notifications/routes';
import tasksRoutes from '@/pages/Tasks/routes';

const router = createBrowserRouter(
  [
    {
      path: '/login',
      element: <LoginPage />,
    },
    {
      path: '/',
      element: (
        <AdminGuard>
          <AdminLayout />
        </AdminGuard>
      ),
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'users', element: <UsersPage /> },
        { path: 'permissions', element: <PermissionsPage /> },
        { path: 'workflow-templates', element: <WorkflowTemplatesPage /> },
        { path: 'node-types', element: <NodeTypesPage /> },
        { path: 'crawler-rules', element: <CrawlerRulesPage /> },
        aiAdminRoutes,
        tasksRoutes,
        billingRoutes,
        notificationsRoutes,
        { path: 'system-configs', element: <SystemConfigsPage /> },
        { path: 'operation-logs', element: <OperationLogsPage /> },
      ],
    },
    {
      path: '*',
      element: <NotFoundPage />,
    },
  ],
  { basename: '/admin' },
);

export default router;
