import { Navigate } from 'react-router-dom';
import CrawlerRulesLayout from './CrawlerRulesLayout';
import RuleDetailPage from './RuleDetailPage';
import RuleTestPage from './RuleTestPage';
import RuleUsagesPage from './RuleUsagesPage';
import RulesListPage from './RulesListPage';

const crawlerRulesRoutes = {
  path: 'crawler-rules',
  element: <CrawlerRulesLayout />,
  children: [
    { index: true, element: <RulesListPage /> },
    { path: ':id', element: <RuleDetailPage /> },
    { path: ':id/test', element: <RuleTestPage /> },
    { path: ':id/usages', element: <RuleUsagesPage /> },
    { path: '*', element: <Navigate to="/crawler-rules" replace /> },
  ],
};

export default crawlerRulesRoutes;
