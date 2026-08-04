import { User, UserRole } from './index';

export type { User, UserRole };

export interface AuthState {
  user: Omit<User, 'created_at' | 'updated_at'> | null;
  isAuthenticated: boolean;
}
