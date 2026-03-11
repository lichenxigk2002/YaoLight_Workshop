export interface AdminUser {
  id: number;
  username: string;
  role: 'admin';
}

export interface AdminSession {
  token: string;
  user: AdminUser;
}

