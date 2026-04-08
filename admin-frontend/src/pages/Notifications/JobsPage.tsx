import { useOutletContext } from 'react-router-dom';
import JobsPanel from './components/JobsPanel';
import type { NotificationsOutletContext } from './outletContext';

export default function NotificationsJobsPage() {
  const { refreshToken } = useOutletContext<NotificationsOutletContext>();
  return <JobsPanel refreshToken={refreshToken} />;
}
