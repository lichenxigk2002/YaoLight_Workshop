import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { lazyElement } from '@/routes/lazyElement';

const FailedTasksPage = lazy(() => import('./FailedTasksPage'));
const OverviewPage = lazy(() => import('./OverviewPage'));
const RunningTasksPage = lazy(() => import('./RunningTasksPage'));
const TaskDetailLayout = lazy(() => import('./TaskDetailLayout'));
const TaskLogsPage = lazy(() => import('./TaskLogsPage'));
const TaskNodesPage = lazy(() => import('./TaskNodesPage'));
const TaskOverviewPage = lazy(() => import('./TaskOverviewPage'));
const TasksLayout = lazy(() => import('./TasksLayout'));

const tasksRoutes = {
  path: 'tasks',
  element: lazyElement(<TasksLayout />),
  children: [
    { index: true, element: lazyElement(<OverviewPage />) },
    { path: 'running', element: lazyElement(<RunningTasksPage />) },
    { path: 'failures', element: lazyElement(<FailedTasksPage />) },
    {
      path: ':id',
      element: lazyElement(<TaskDetailLayout />),
      children: [
        { index: true, element: lazyElement(<TaskOverviewPage />) },
        { path: 'nodes', element: lazyElement(<TaskNodesPage />) },
        { path: 'logs', element: lazyElement(<TaskLogsPage />) },
      ],
    },
    { path: '*', element: <Navigate to="/tasks" replace /> },
  ],
};

export default tasksRoutes;
