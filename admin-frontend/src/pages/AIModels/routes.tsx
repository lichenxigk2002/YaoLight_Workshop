import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { lazyElement } from '@/routes/lazyElement';

const AIModelsLayout = lazy(() => import('./AIModelsLayout'));
const AIModelsHomePage = lazy(() => import('./index'));
const ModelCapabilityPage = lazy(() => import('./ModelCapabilityPage'));
const ModelCreatePage = lazy(() => import('./ModelCreatePage'));
const ModelDetailLayout = lazy(() => import('./ModelDetailLayout'));
const ModelOverviewPage = lazy(() => import('./ModelOverviewPage'));
const ModelPricingPage = lazy(() => import('./ModelPricingPage'));
const MonitoringPage = lazy(() => import('./MonitoringPage'));
const ModelsPage = lazy(() => import('./ModelsPage'));
const PricingRulesPage = lazy(() => import('./PricingRulesPage'));
const ProviderDetailPage = lazy(() => import('./ProviderDetailPage'));
const ProvidersPage = lazy(() => import('./ProvidersPage'));
const UsagePage = lazy(() => import('./UsagePage'));

const aiAdminRoutes = {
  path: 'ai-models',
  element: lazyElement(<AIModelsLayout />),
  children: [
    { index: true, element: lazyElement(<AIModelsHomePage />) },
    { path: 'providers', element: lazyElement(<ProvidersPage />) },
    { path: 'providers/:provider', element: lazyElement(<ProviderDetailPage />) },
    { path: 'models', element: lazyElement(<ModelsPage />) },
    { path: 'models/new', element: lazyElement(<ModelCreatePage />) },
    {
      path: 'models/:id',
      element: lazyElement(<ModelDetailLayout />),
      children: [
        { index: true, element: lazyElement(<ModelOverviewPage />) },
        { path: 'capability', element: lazyElement(<ModelCapabilityPage />) },
        { path: 'pricing', element: lazyElement(<ModelPricingPage />) },
      ],
    },
    { path: 'pricing-rules', element: lazyElement(<PricingRulesPage />) },
    { path: 'usage', element: lazyElement(<UsagePage />) },
    { path: 'monitoring', element: lazyElement(<MonitoringPage />) },
    { path: '*', element: <Navigate to="/ai-models" replace /> },
  ],
};

export default aiAdminRoutes;
