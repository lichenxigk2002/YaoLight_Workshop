import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from '../components/ProtectedRoute'
import Layout from '../components/Layout'

const Login = lazy(() => import('../pages/Login'))
const Dashboard = lazy(() => import('../pages/Dashboard'))
const ProjectDetail = lazy(() => import('../pages/ProjectDetail'))
const PublicWorkflowApiDocsPage = lazy(() => import('../pages/PublicWorkflowApiDocs'))
const WorkflowApiPage = lazy(() => import('../pages/WorkflowApi'))
const WorkflowEditor = lazy(() => import('../components/WorkflowEditor'))
const Settings = lazy(() => import('../pages/Settings'))
const ProfileInfo = lazy(() => import('../pages/Settings/Profile'))
const ModelProviders = lazy(() => import('../pages/Settings/Models'))
const Billing = lazy(() => import('../pages/Settings/Billing'))
const OrdersPage = lazy(() => import('../pages/Settings/Orders'))
const Invite = lazy(() => import('../pages/Settings/Invite'))
const SettingsNotifications = lazy(() => import('../pages/Settings/Notifications'))
const Payment = lazy(() => import('../pages/Payment'))
const PaymentCallback = lazy(() => import('../pages/Payment/Callback'))
const Help = lazy(() => import('../pages/Help'))
const AssistantWorkspace = lazy(() => import('../pages/AssistantWorkspace'))
const ConversationsPage = lazy(() => import('../pages/Conversations'))
const AssistantSettings = lazy(() => import('../pages/Settings/Assistant'))
const TokenTransactions = lazy(() => import('../pages/Settings/TokenTransactions'))
const MCPAccessPage = lazy(() => import('../pages/Settings/MCPAccess'))

function routeElement(children: ReactNode) {
  return <Suspense fallback={<div />}>{children}</Suspense>
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: routeElement(<Login />),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<Dashboard />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/workflows',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<ProjectDetail />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/assets',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<ProjectDetail />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/automation',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<ProjectDetail />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/workflows/:workflowId/edit',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<WorkflowEditor />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/workflows/:workflowId/api',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<WorkflowApiPage />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/open-api-docs/:slug',
    element: (
      <Layout>
        {routeElement(<PublicWorkflowApiDocsPage />)}
      </Layout>
    ),
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<Settings />)}
        </Layout>
      </ProtectedRoute>
    ),
    children: [
      {
        path: '',
        element: <Navigate to="profile" replace />,
      },
      {
        path: 'profile',
        element: routeElement(<ProfileInfo />),
      },
      {
        path: 'models',
        element: routeElement(<ModelProviders />),
      },
      {
        path: 'orders',
        element: routeElement(<OrdersPage />),
      },
      {
        path: 'recharge',
        element: routeElement(<Payment />),
      },
      {
        path: 'billing',
        element: routeElement(<Billing />),
      },
      {
        path: 'token-transactions',
        element: routeElement(<TokenTransactions />),
      },
      {
        path: 'invite',
        element: routeElement(<Invite />),
      },
      {
        path: 'notifications',
        element: routeElement(<SettingsNotifications />),
      },
      {
        path: 'assistant',
        element: routeElement(<AssistantSettings />),
      },
      {
        path: 'ai-tools',
        element: routeElement(<MCPAccessPage />),
      },
    ],
  },
  {
    path: '/assistant',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<AssistantWorkspace />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/conversations',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<ConversationsPage />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/payment',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<Payment />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/payment/callback',
    element: routeElement(<PaymentCallback />),
  },
  {
    path: '/help',
    element: (
      <ProtectedRoute>
        <Layout>
          {routeElement(<Help />)}
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
], {
  future: {
    v7_startTransition: true,
  },
})

export default router
