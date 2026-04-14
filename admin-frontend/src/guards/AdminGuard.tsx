import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getAdminSession } from '@/utils/storage';

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const location = useLocation();
  const session = getAdminSession();

  if (!session?.token || session.user.role !== 'admin') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
