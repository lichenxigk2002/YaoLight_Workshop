import { Navigate } from 'react-router-dom';
import AIModuleLayout from './AIModuleLayout';
import AIProvidersPage from './pages/AIProvidersPage';
import AIProviderDetailPage from './pages/AIProviderDetailPage';
import AIModelsPage from './pages/AIModelsPage';
import AIModelCreatePage from './pages/AIModelCreatePage';
import AIModelOverviewPage from './pages/AIModelOverviewPage';
import AIModelCapabilityPage from './pages/AIModelCapabilityPage';
import AIModelPricingPage from './pages/AIModelPricingPage';
import AIPricingRulesPage from './pages/AIPricingRulesPage';
import AIUsagePage from './pages/AIUsagePage';
import AIMonitoringPage from './pages/AIMonitoringPage';

const aiAdminRoutes = {
  path: 'ai-models',
  element: <AIModuleLayout />,
  children: [
    { index: true, element: <Navigate to="providers" replace /> },
    { path: 'providers', element: <AIProvidersPage /> },
    { path: 'providers/:provider', element: <AIProviderDetailPage /> },
    { path: 'models', element: <AIModelsPage /> },
    { path: 'models/new', element: <AIModelCreatePage /> },
    { path: 'models/:provider/:modelName', element: <AIModelOverviewPage /> },
    { path: 'models/:provider/:modelName/capability', element: <AIModelCapabilityPage /> },
    { path: 'models/:provider/:modelName/pricing', element: <AIModelPricingPage /> },
    { path: 'pricing-rules', element: <AIPricingRulesPage /> },
    { path: 'usage', element: <AIUsagePage /> },
    { path: 'monitoring', element: <AIMonitoringPage /> },
  ],
};

export default aiAdminRoutes;
