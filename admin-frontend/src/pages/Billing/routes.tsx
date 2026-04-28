import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import { lazyElement } from '@/routes/lazyElement';

const BillingLayout = lazy(() => import('./BillingLayout'));
const OverviewPage = lazy(() => import('./OverviewPage'));
const QuotaRecoveryPage = lazy(() => import('./QuotaRecoveryPage'));
const AdminGrantPage = lazy(() => import('./AdminGrantPage'));
const QuotaLedgerPage = lazy(() => import('./QuotaLedgerPage'));
const OrdersPage = lazy(() => import('./OrdersPage'));
const TokenLedgerPage = lazy(() => import('./TokenLedgerPage'));
const PackagesPage = lazy(() => import('./PackagesPage'));

const billingRoutes = {
  path: 'billing',
  element: lazyElement(<BillingLayout />),
  children: [
    { index: true, element: lazyElement(<OverviewPage />) },
    { path: 'quota-recovery', element: lazyElement(<QuotaRecoveryPage />) },
    { path: 'admin-grant', element: lazyElement(<AdminGrantPage />) },
    { path: 'packages', element: lazyElement(<PackagesPage />) },
    { path: 'ledger', element: lazyElement(<QuotaLedgerPage />) },
    { path: 'orders', element: lazyElement(<OrdersPage />) },
    { path: 'token-ledger', element: lazyElement(<TokenLedgerPage />) },
    { path: '*', element: <Navigate to="/billing" replace /> },
  ],
};

export default billingRoutes;
