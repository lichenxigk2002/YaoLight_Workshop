import { useNavigate, useOutletContext } from 'react-router-dom';
import SendPanel from './components/SendPanel';
import type { NotificationsOutletContext } from './outletContext';

export default function NotificationsSendPage() {
  const navigate = useNavigate();
  const { triggerRefresh } = useOutletContext<NotificationsOutletContext>();

  return (
    <SendPanel
      onSent={() => {
        triggerRefresh();
        navigate('/notifications/jobs');
      }}
    />
  );
}
