export type UserRole = 'admin' | 'user';
export type AccountStatus = 'active' | 'blocked';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: AccountStatus;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  ownerId: string;
  name: string;
  year: number;
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';
  lastServiceDate?: string;
  nextServiceDate?: string;
  documents?: string[];
  totalKm?: number;
  avgDailyKm?: number;
  serviceIntervalKm?: number;
  serviceIntervalMonths?: number;
  urgency?: 'Low' | 'Medium' | 'High';
}

export interface Appointment {
  id: string;
  userId: string;
  vehicleId: string;
  serviceType: string;
  date: string;
  status: 'pending' | 'accepted' | 'rejected';
  notes?: string;
}

export interface Job {
  id: string;
  appointmentId: string;
  vehicleId: string;
  userId: string;
  status: 'pending' | 'in-progress' | 'completed';
  tasks: string[];
  cost: number;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  partName: string;
  stock: number;
  minStockAlert: number;
  price: number;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  read: boolean;
  type: string;
  createdAt: string;
}
