import { Navigate } from 'react-router-dom';
import BillingLayout from './BillingLayout';
import OverviewPage from './OverviewPage';
import QuotaRecoveryPage from './QuotaRecoveryPage';
import AdminGrantPage from './AdminGrantPage';
import QuotaLedgerPage from './QuotaLedgerPage';
import OrdersPage from './OrdersPage';
import TokenLedgerPage from './TokenLedgerPage';

const billingRoutes = {
  path: 'billing',
  element: <BillingLayout />,
  children: [
    { index: true, element: <OverviewPage /> },
    { path: 'quota-recovery', element: <QuotaRecoveryPage /> },
    { path: 'admin-grant', element: <AdminGrantPage /> },
    { path: 'ledger', element: <QuotaLedgerPage /> },
    { path: 'orders', element: <OrdersPage /> },
    { path: 'token-ledger', element: <TokenLedgerPage /> },
    { path: '*', element: <Navigate to="/billing" replace /> },
  ],
};

export default billingRoutes;
