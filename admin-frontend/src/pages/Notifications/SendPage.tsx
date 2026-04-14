import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import SendPanel from './components/SendPanel';
import type { NotificationsOutletContext } from './outletContext';

export default function NotificationsSendPage() {
  const navigate = useNavigate();
  const { triggerRefresh } = useOutletContext<NotificationsOutletContext>();
  const { canEdit } = useAdminPermission('notifications.send');

  return (
    <SendPanel
      disabled={!canEdit}
      onSent={() => {
        triggerRefresh();
        navigate('/notifications/jobs');
      }}
    />
  );
}
