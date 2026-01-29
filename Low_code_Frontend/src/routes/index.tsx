import React from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import ProjectDetail from '../pages/ProjectDetail'
import Profile from '../pages/Profile'
import WorkflowEditor from '../components/WorkflowEditor'
import ProtectedRoute from '../components/ProtectedRoute'
import Layout from '../components/Layout'
import Settings from '../pages/Settings'
import ProfileInfo from '../pages/Settings/Profile'
import ModelProviders from '../pages/Settings/Models'
import Billing from '../pages/Settings/Billing'
import SettingsNotifications from '../pages/Settings/Notifications'
import Payment from '../pages/Payment'
import Help from '../pages/Help'

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
        path: 'recharge',
        element: <Payment />,
      },
      {
        path: 'billing',
        element: <Billing />,
      },
      {
        path: 'notifications',
        element: <SettingsNotifications />,
      },
    ],
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
