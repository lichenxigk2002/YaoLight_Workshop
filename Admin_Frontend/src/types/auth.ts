export interface AdminUser {
  id: number;
  username: string;
  role: 'admin';
  permissions: string[];
}

export interface AdminSession {
  token: string;
  user: AdminUser;
}

