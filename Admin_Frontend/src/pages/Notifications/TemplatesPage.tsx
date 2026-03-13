import { useOutletContext } from 'react-router-dom';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import TemplatesPanel from './components/TemplatesPanel';
import type { NotificationsOutletContext } from './outletContext';

export default function NotificationsTemplatesPage() {
  const { refreshToken, triggerRefresh } = useOutletContext<NotificationsOutletContext>();
  const { canEdit } = useAdminPermission('notifications.templates');

  return <TemplatesPanel refreshToken={refreshToken} onChanged={triggerRefresh} disabled={!canEdit} />;
}
