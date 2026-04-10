export type UserRole = 'admin' | 'manager' | 'staff' | 'executive' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  employeeId?: string;
  shift?: string;
  lastActive?: any;
  isOnline?: boolean;
}

export type RepairStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
export type Urgency = 'normal' | 'urgent';

export interface RepairRequest {
  id: string;
  timestamp: any; // Firestore Timestamp
  requesterName: string;
  requesterId: string;
  requesterEmail: string;
  requesterShift: string;
  machineName: string;
  currentTask: string;
  problem: string;
  area: string;
  building?: string;
  urgency: Urgency;
  status: RepairStatus;
  repairType?: string;
  beforePhoto?: string;
  afterPhoto?: string;
  startTime?: any;
  endTime?: any;
  repairDuration?: number; // in minutes
  failureCause?: string;
  repairAction?: string;
  technicianName?: string;
  technicianId?: string;
  technicianShift?: string;
  supervisorName?: string;
  notes?: string;
  afterPhotoUrl?: string;
}

export interface MasterData {
  types: string[];
  areas: string[];
  buildings: string[];
  urgencies: string[];
  lineToken?: string; // Keep for backward compatibility
  lineConfig?: {
    token: string;
    enabled: boolean;
    notifyUrgentOnly: boolean;
    notifyOnCreate: boolean;
    notifyOnComplete: boolean;
  };
  emailConfig?: {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPass: string;
    fromEmail: string;
    toEmail: string;
    enabled: boolean;
    notifyUrgentOnly: boolean;
    notifyOnCreate: boolean;
    notifyOnComplete: boolean;
  };
}
