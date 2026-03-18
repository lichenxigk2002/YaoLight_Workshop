export interface AdminUser {
  id: number;
  username: string;
  role: 'admin';
  permissions: string[];
  avatar_url?: string | null;
}

export interface AdminSession {
  token: string;
  user: AdminUser;
}

