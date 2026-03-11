import { Navigate } from 'react-router-dom';
import AIModelsLayout from './AIModelsLayout';
import AIModelsHomePage from './index';
import ModelCapabilityPage from './ModelCapabilityPage';
import ModelCreatePage from './ModelCreatePage';
import ModelDetailLayout from './ModelDetailLayout';
import ModelOverviewPage from './ModelOverviewPage';
import ModelPricingPage from './ModelPricingPage';
import ModelsPage from './ModelsPage';
import PricingRulesPage from './PricingRulesPage';
import ProviderDetailPage from './ProviderDetailPage';
import ProvidersPage from './ProvidersPage';
import UsagePage from './UsagePage';

const aiAdminRoutes = {
  path: 'ai-models',
  element: <AIModelsLayout />,
  children: [
    { index: true, element: <AIModelsHomePage /> },
    { path: 'providers', element: <ProvidersPage /> },
    { path: 'providers/:provider', element: <ProviderDetailPage /> },
    { path: 'models', element: <ModelsPage /> },
    { path: 'models/new', element: <ModelCreatePage /> },
    {
      path: 'models/:id',
      element: <ModelDetailLayout />,
      children: [
        { index: true, element: <ModelOverviewPage /> },
        { path: 'capability', element: <ModelCapabilityPage /> },
        { path: 'pricing', element: <ModelPricingPage /> },
      ],
    },
    { path: 'pricing-rules', element: <PricingRulesPage /> },
    { path: 'usage', element: <UsagePage /> },
    { path: '*', element: <Navigate to="/ai-models" replace /> },
  ],
};

export default aiAdminRoutes;
