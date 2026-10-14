import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { lazyElement } from '@/routes/lazyElement';

const CrawlerRulesLayout = lazy(() => import('./CrawlerRulesLayout'));
const RuleDetailPage = lazy(() => import('./RuleDetailPage'));
const RuleTestPage = lazy(() => import('./RuleTestPage'));
const RuleUsagesPage = lazy(() => import('./RuleUsagesPage'));
const RulesListPage = lazy(() => import('./RulesListPage'));

const crawlerRulesRoutes = {
  path: 'crawler-rules',
  element: lazyElement(<CrawlerRulesLayout />),
  children: [
    { index: true, element: lazyElement(<RulesListPage />) },
    { path: ':id', element: lazyElement(<RuleDetailPage />) },
    { path: ':id/test', element: lazyElement(<RuleTestPage />) },
    { path: ':id/usages', element: lazyElement(<RuleUsagesPage />) },
    { path: '*', element: <Navigate to="/crawler-rules" replace /> },
  ],
};

export default crawlerRulesRoutes;
