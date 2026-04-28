import { lazy } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { lazyElement } from '@/routes/lazyElement';

const WorkflowTemplatesPage = lazy(() => import('./index'));
const WorkflowTemplateCanvasPage = lazy(() => import('./TemplateCanvasPage'));

const workflowTemplateRoutes = {
  path: 'workflow-templates',
  element: <Outlet />,
  children: [
    { index: true, element: lazyElement(<WorkflowTemplatesPage />) },
    { path: ':id/canvas', element: lazyElement(<WorkflowTemplateCanvasPage />) },
    { path: '*', element: <Navigate to="/workflow-templates" replace /> },
  ],
};

export default workflowTemplateRoutes;
