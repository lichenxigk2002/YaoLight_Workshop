import { Navigate } from 'react-router-dom';
import FailedTasksPage from './FailedTasksPage';
import OverviewPage from './OverviewPage';
import RunningTasksPage from './RunningTasksPage';
import TaskDetailLayout from './TaskDetailLayout';
import TaskLogsPage from './TaskLogsPage';
import TaskNodesPage from './TaskNodesPage';
import TaskOverviewPage from './TaskOverviewPage';
import TasksLayout from './TasksLayout';

const tasksRoutes = {
  path: 'tasks',
  element: <TasksLayout />,
  children: [
    { index: true, element: <OverviewPage /> },
    { path: 'running', element: <RunningTasksPage /> },
    { path: 'failures', element: <FailedTasksPage /> },
    {
      path: ':id',
      element: <TaskDetailLayout />,
      children: [
        { index: true, element: <TaskOverviewPage /> },
        { path: 'nodes', element: <TaskNodesPage /> },
        { path: 'logs', element: <TaskLogsPage /> },
      ],
    },
    { path: '*', element: <Navigate to="/tasks" replace /> },
  ],
};

export default tasksRoutes;
