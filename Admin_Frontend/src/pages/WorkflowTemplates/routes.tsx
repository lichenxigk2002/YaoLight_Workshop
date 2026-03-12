import { Navigate, Outlet } from 'react-router-dom';
import WorkflowTemplatesPage from './index';
import WorkflowTemplateCanvasPage from './TemplateCanvasPage';

const workflowTemplateRoutes = {
  path: 'workflow-templates',
  element: <Outlet />,
  children: [
    { index: true, element: <WorkflowTemplatesPage /> },
    { path: ':id/canvas', element: <WorkflowTemplateCanvasPage /> },
    { path: '*', element: <Navigate to="/workflow-templates" replace /> },
  ],
};

export default workflowTemplateRoutes;
