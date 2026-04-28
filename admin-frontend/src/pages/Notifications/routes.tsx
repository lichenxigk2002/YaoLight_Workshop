import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { lazyElement } from '@/routes/lazyElement';

const NotificationsAnalyticsPage = lazy(() => import('./AnalyticsPage'));
const NotificationsJobsPage = lazy(() => import('./JobsPage'));
const NotificationsLayout = lazy(() => import('./index'));
const NotificationsLogPage = lazy(() => import('./LogPage'));
const NotificationsSendPage = lazy(() => import('./SendPage'));
const NotificationsTemplatesPage = lazy(() => import('./TemplatesPage'));

const notificationsRoutes = {
  path: 'notifications',
  element: lazyElement(<NotificationsLayout />),
  children: [
    { index: true, element: <Navigate to="/notifications/send" replace /> },
    { path: 'send', element: lazyElement(<NotificationsSendPage />) },
    { path: 'jobs', element: lazyElement(<NotificationsJobsPage />) },
    { path: 'log', element: lazyElement(<NotificationsLogPage />) },
    { path: 'analytics', element: lazyElement(<NotificationsAnalyticsPage />) },
    { path: 'templates', element: lazyElement(<NotificationsTemplatesPage />) },
    { path: '*', element: <Navigate to="/notifications/send" replace /> },
  ],
};

export default notificationsRoutes;
