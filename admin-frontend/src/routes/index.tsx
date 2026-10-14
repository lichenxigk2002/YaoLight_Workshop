import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import AdminGuard from '@/guards/AdminGuard';
import AdminLayout from '@/layouts/AdminLayout';
import billingRoutes from '@/pages/Billing/routes';
import crawlerRulesRoutes from '@/pages/CrawlerRules/routes';
import permissionsRoutes from '@/pages/Permissions/routes';
import aiAdminRoutes from '@/pages/AIModels/routes';
import notificationsRoutes from '@/pages/Notifications/routes';
import tasksRoutes from '@/pages/Tasks/routes';
import workflowTemplateRoutes from '@/pages/WorkflowTemplates/routes';
import { lazyElement } from './lazyElement';

const AppLogsPage = lazy(() => import('@/pages/AppLogs'));
const ContentCommentsPage = lazy(() => import('@/pages/ContentComments'));
const DashboardPage = lazy(() => import('@/pages/Dashboard'));
const LoginPage = lazy(() => import('@/pages/Login'));
const KnowledgeBasePage = lazy(() => import('@/pages/KnowledgeBase'));
const MCPAccessAdminPage = lazy(() => import('@/pages/MCPAccess'));
const NodeTypesPage = lazy(() => import('@/pages/NodeTypes'));
const NotFoundPage = lazy(() => import('@/pages/NotFound'));
const OperationLogsPage = lazy(() => import('@/pages/OperationLogs'));
const SystemConfigsPage = lazy(() => import('@/pages/SystemConfigs'));
const UsersPage = lazy(() => import('@/pages/Users'));

const router = createBrowserRouter(
  [
    {
      path: '/login',
      element: lazyElement(<LoginPage />),
    },
    {
      path: '/',
      element: (
        <AdminGuard>
          <AdminLayout />
        </AdminGuard>
      ),
      children: [
        { index: true, element: lazyElement(<DashboardPage />) },
        { path: 'users', element: lazyElement(<UsersPage />) },
        permissionsRoutes,
        workflowTemplateRoutes,
        { path: 'node-types', element: lazyElement(<NodeTypesPage />) },
        { path: 'knowledge-base', element: lazyElement(<KnowledgeBasePage />) },
        { path: 'content-comments', element: lazyElement(<ContentCommentsPage />) },
        crawlerRulesRoutes,
        aiAdminRoutes,
        tasksRoutes,
        billingRoutes,
        notificationsRoutes,
        { path: 'system-configs', element: lazyElement(<SystemConfigsPage />) },
        { path: 'mcp-access', element: lazyElement(<MCPAccessAdminPage />) },
        { path: 'app-logs', element: <Navigate to="/logs/app" replace /> },
        { path: 'operation-logs', element: <Navigate to="/logs/operation" replace /> },
        { path: 'logs/app', element: lazyElement(<AppLogsPage />) },
        { path: 'logs/operation', element: lazyElement(<OperationLogsPage />) },
      ],
    },
    {
      path: '*',
      element: lazyElement(<NotFoundPage />),
    },
  ],
  { basename: '/admin' },
);

export default router;
