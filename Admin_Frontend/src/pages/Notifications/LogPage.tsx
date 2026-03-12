import { useOutletContext } from 'react-router-dom';
import NotificationLogPanel from './components/NotificationLogPanel';
import type { NotificationsOutletContext } from './outletContext';

export default function NotificationsLogPage() {
  const { refreshToken } = useOutletContext<NotificationsOutletContext>();
  return <NotificationLogPanel refreshToken={refreshToken} />;
}
