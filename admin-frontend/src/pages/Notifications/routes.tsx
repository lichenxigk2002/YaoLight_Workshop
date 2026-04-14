import { Navigate } from 'react-router-dom';
import NotificationsAnalyticsPage from './AnalyticsPage';
import NotificationsJobsPage from './JobsPage';
import NotificationsLayout from './index';
import NotificationsLogPage from './LogPage';
import NotificationsSendPage from './SendPage';
import NotificationsTemplatesPage from './TemplatesPage';

const notificationsRoutes = {
  path: 'notifications',
  element: <NotificationsLayout />,
  children: [
    { index: true, element: <Navigate to="/notifications/send" replace /> },
    { path: 'send', element: <NotificationsSendPage /> },
    { path: 'jobs', element: <NotificationsJobsPage /> },
    { path: 'log', element: <NotificationsLogPage /> },
    { path: 'analytics', element: <NotificationsAnalyticsPage /> },
    { path: 'templates', element: <NotificationsTemplatesPage /> },
    { path: '*', element: <Navigate to="/notifications/send" replace /> },
  ],
};

export default notificationsRoutes;
