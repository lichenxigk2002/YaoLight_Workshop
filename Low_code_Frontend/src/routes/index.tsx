import React from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import Login from '../pages/Login'
import Dashboard from '../pages/Dashboard'
import ProjectDetail from '../pages/ProjectDetail'
import Profile from '../pages/Profile'
import WorkflowEditor from '../components/WorkflowEditor'
import ProtectedRoute from '../components/ProtectedRoute'
import Layout from '../components/Layout'

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
    path: '/profile',
    element: (
      <ProtectedRoute>
        <Layout>
          <Profile />
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

