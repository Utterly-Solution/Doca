import { User } from './types';

const STORAGE_KEYS = {
  USERS: 'doca_users',
  CURRENT_SESSION: 'doca_current_session',
  LAST_ACTIVITY: 'doca_last_activity',
};

export interface AuthSession {
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
}

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours
const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

// Default users for the system (seeded on first load)
const DEFAULT_USERS: (User & { password: string })[] = [
  {
    id: 'user-001',
    name: 'Haris',
    email: 'm.haris@homecare.agency',
    role: 'Administrator',
    password: 'Admin@123',
  },
  {
    id: 'user-002',
    name: 'Dr. Fazool',
    email: 'fazool@homecare.agency',
    role: 'Nurse',
    password: 'Nurse@123',
  },
];

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

function removeItem(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

// Seed default users if not present
export function seedUsers(): void {
  const existing = getItem<(User & { password: string })[]>(STORAGE_KEYS.USERS, []);
  if (existing.length === 0) {
    setItem(STORAGE_KEYS.USERS, DEFAULT_USERS);
  }
}

export function authenticate(email: string, password: string): { user: User; session: AuthSession } | null {
  const users = getItem<(User & { password: string })[]>(STORAGE_KEYS.USERS, []);
  const found = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!found) return null;

  const session: AuthSession = {
    userId: found.id,
    token: crypto.randomUUID(),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    createdAt: new Date().toISOString(),
  };

  setItem(STORAGE_KEYS.CURRENT_SESSION, session);
  updateLastActivity();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pwd, ...user } = found;
  return { user, session };
}

export function getCurrentSession(): AuthSession | null {
  const session = getItem<AuthSession | null>(STORAGE_KEYS.CURRENT_SESSION, null);
  if (!session) return null;

  // Check if session has expired
  if (new Date(session.expiresAt) < new Date()) {
    logout();
    return null;
  }

  // Check inactivity timeout
  const lastActivity = getItem<string | null>(STORAGE_KEYS.LAST_ACTIVITY, null);
  if (lastActivity) {
    const inactiveMs = Date.now() - new Date(lastActivity).getTime();
    if (inactiveMs > INACTIVITY_TIMEOUT_MS) {
      logout();
      return null;
    }
  }

  return session;
}

export function getCurrentUser(): User | null {
  const session = getCurrentSession();
  if (!session) return null;

  const users = getItem<(User & { password: string })[]>(STORAGE_KEYS.USERS, []);
  const found = users.find((u) => u.id === session.userId);
  if (!found) return null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pwd, ...user } = found;
  return user;
}

export function updateLastActivity(): void {
  setItem(STORAGE_KEYS.LAST_ACTIVITY, new Date().toISOString());
}

export function logout(): void {
  removeItem(STORAGE_KEYS.CURRENT_SESSION);
  removeItem(STORAGE_KEYS.LAST_ACTIVITY);
}

// Role-based permissions
export type Permission = 'upload' | 'analyze' | 'chat' | 'edit' | 'delete' | 'export' | 'manage_kb' | 'view_audit' | 'manage_users';

const ROLE_PERMISSIONS: Record<User['role'], Permission[]> = {
  'Administrator': ['upload', 'analyze', 'chat', 'edit', 'delete', 'export', 'manage_kb', 'view_audit', 'manage_users'],
  'Care Coordinator': ['upload', 'analyze', 'chat', 'edit', 'export'],
  'Nurse': ['upload', 'analyze', 'chat', 'edit', 'export'],
  'Caregiver': ['upload', 'chat', 'export'],
  'Compliance Officer': ['analyze', 'chat', 'export', 'view_audit', 'delete'],
};

export function hasPermission(role: User['role'], permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getUserPermissions(role: User['role']): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
