import { useOutletContext } from 'react-router-dom';
import AnalyticsPanel from './components/AnalyticsPanel';
import type { NotificationsOutletContext } from './outletContext';

export default function NotificationsAnalyticsPage() {
  const { refreshToken } = useOutletContext<NotificationsOutletContext>();
  return <AnalyticsPanel refreshToken={refreshToken} />;
}
