
export type Role = 'protected' | 'protector';

export interface User {
  id: string;
  name: string;
  phone: string;
  email: string;
  role: Role;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar: string;
}

export interface SafetyLog {
  id: string;
  type: 'checkin' | 'alert' | 'status' | 'emergency';
  title: string;
  description: string;
  timestamp: string;
  location?: string;
  status?: 'confirmed' | 'pending' | 'auto';
}
