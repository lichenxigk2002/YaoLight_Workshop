import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import ProjectDetail from '../pages/ProjectDetail'
import PublicWorkflowApiDocsPage from '../pages/PublicWorkflowApiDocs'
import WorkflowApiPage from '../pages/WorkflowApi'
import WorkflowEditor from '../components/WorkflowEditor'
import ProtectedRoute from '../components/ProtectedRoute'
import Layout from '../components/Layout'
import Settings from '../pages/Settings'
import ProfileInfo from '../pages/Settings/Profile'
import ModelProviders from '../pages/Settings/Models'
import Billing from '../pages/Settings/Billing'
import OrdersPage from '../pages/Settings/Orders'
import Invite from '../pages/Settings/Invite'
import SettingsNotifications from '../pages/Settings/Notifications'
import Payment from '../pages/Payment'
import PaymentCallback from '../pages/Payment/Callback'
import Help from '../pages/Help'
import AssistantWorkspace from '../pages/AssistantWorkspace'
import ConversationsPage from '../pages/Conversations'
import AssistantSettings from '../pages/Settings/Assistant'
import TokenTransactions from '../pages/Settings/TokenTransactions'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout>
          <Dashboard />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/workflows',
    element: (
      <ProtectedRoute>
        <Layout>
          <ProjectDetail />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/assets',
    element: (
      <ProtectedRoute>
        <Layout>
          <ProjectDetail />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/workflows/:workflowId/edit',
    element: (
      <ProtectedRoute>
        <Layout>
          <WorkflowEditor />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/projects/:projectId/workflows/:workflowId/api',
    element: (
      <ProtectedRoute>
        <Layout>
          <WorkflowApiPage />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/open-api-docs/:slug',
    element: <PublicWorkflowApiDocsPage />,
  },
  {
    path: '/settings',
    element: (
      <ProtectedRoute>
        <Layout>
          <Settings />
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
        element: <ProfileInfo />,
      },
      {
        path: 'models',
        element: <ModelProviders />,
      },
      {
        path: 'orders',
        element: <OrdersPage />,
      },
      {
        path: 'recharge',
        element: <Payment />,
      },
      {
        path: 'billing',
        element: <Billing />,
      },
      {
        path: 'token-transactions',
        element: <TokenTransactions />,
      },
      {
        path: 'invite',
        element: <Invite />,
      },
      {
        path: 'notifications',
        element: <SettingsNotifications />,
      },
      {
        path: 'assistant',
        element: <AssistantSettings />,
      },
    ],
  },
  {
    path: '/assistant',
    element: (
      <ProtectedRoute>
        <Layout>
          <AssistantWorkspace />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/conversations',
    element: (
      <ProtectedRoute>
        <Layout>
          <ConversationsPage />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/payment',
    element: (
      <ProtectedRoute>
        <Layout>
          <Payment />
        </Layout>
      </ProtectedRoute>
    ),
  },
  {
    path: '/payment/callback',
    element: <PaymentCallback />,
  },
  {
    path: '/help',
    element: (
      <ProtectedRoute>
        <Layout>
          <Help />
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
