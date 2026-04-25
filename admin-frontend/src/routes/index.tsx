import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminGuard from '@/guards/AdminGuard';
import AdminLayout from '@/layouts/AdminLayout';
import billingRoutes from '@/pages/Billing/routes';
import AppLogsPage from '@/pages/AppLogs';
import crawlerRulesRoutes from '@/pages/CrawlerRules/routes';
import ContentCommentsPage from '@/pages/ContentComments';
import DashboardPage from '@/pages/Dashboard';
import LoginPage from '@/pages/Login';
import KnowledgeBasePage from '@/pages/KnowledgeBase';
import MCPAccessAdminPage from '@/pages/MCPAccess';
import NodeTypesPage from '@/pages/NodeTypes';
import NotFoundPage from '@/pages/NotFound';
import OperationLogsPage from '@/pages/OperationLogs';
import permissionsRoutes from '@/pages/Permissions/routes';
import SystemConfigsPage from '@/pages/SystemConfigs';
import UsersPage from '@/pages/Users';
import aiAdminRoutes from '@/pages/AIModels/routes';
import notificationsRoutes from '@/pages/Notifications/routes';
import tasksRoutes from '@/pages/Tasks/routes';
import workflowTemplateRoutes from '@/pages/WorkflowTemplates/routes';

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
        permissionsRoutes,
        workflowTemplateRoutes,
        { path: 'node-types', element: <NodeTypesPage /> },
        { path: 'knowledge-base', element: <KnowledgeBasePage /> },
        { path: 'content-comments', element: <ContentCommentsPage /> },
        crawlerRulesRoutes,
        aiAdminRoutes,
        tasksRoutes,
        billingRoutes,
        notificationsRoutes,
        { path: 'system-configs', element: <SystemConfigsPage /> },
        { path: 'mcp-access', element: <MCPAccessAdminPage /> },
        { path: 'app-logs', element: <Navigate to="/logs/app" replace /> },
        { path: 'operation-logs', element: <Navigate to="/logs/operation" replace /> },
        { path: 'logs/app', element: <AppLogsPage /> },
        { path: 'logs/operation', element: <OperationLogsPage /> },
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
