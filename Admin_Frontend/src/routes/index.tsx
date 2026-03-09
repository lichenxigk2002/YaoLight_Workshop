import { createBrowserRouter } from 'react-router-dom';
import AdminGuard from '@/guards/AdminGuard';
import AdminLayout from '@/layouts/AdminLayout';
import billingRoutes from '@/pages/Billing/routes';
import CrawlerRulesPage from '@/pages/CrawlerRules';
import DashboardPage from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';
import NodeTypesPage from '@/pages/NodeTypes';
import NotificationsPage from '@/pages/Notifications';
import NotFoundPage from '@/pages/NotFound';
import OperationLogsPage from '@/pages/OperationLogs';
import SystemConfigsPage from '@/pages/SystemConfigs';
import TasksPage from '@/pages/Tasks';
import UsersPage from '@/pages/Users';
import WorkflowTemplatesPage from '@/pages/WorkflowTemplates';
import aiAdminRoutes from '@/pages/AIModels/routes';

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
      { path: 'workflow-templates', element: <WorkflowTemplatesPage /> },
      { path: 'node-types', element: <NodeTypesPage /> },
      { path: 'crawler-rules', element: <CrawlerRulesPage /> },
      aiAdminRoutes,
      { path: 'tasks', element: <TasksPage /> },
      billingRoutes,
      { path: 'system-configs', element: <SystemConfigsPage /> },
      { path: 'notifications', element: <NotificationsPage /> },
      { path: 'operation-logs', element: <OperationLogsPage /> },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
], { basename: '/admin' });

export default router;
