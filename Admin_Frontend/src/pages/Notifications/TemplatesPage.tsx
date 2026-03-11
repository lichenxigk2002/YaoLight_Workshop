import { useOutletContext } from 'react-router-dom';
import TemplatesPanel from './components/TemplatesPanel';
import type { NotificationsOutletContext } from './outletContext';

export default function NotificationsTemplatesPage() {
  const { refreshToken, triggerRefresh } = useOutletContext<NotificationsOutletContext>();
  return <TemplatesPanel refreshToken={refreshToken} onChanged={triggerRefresh} />;
}
