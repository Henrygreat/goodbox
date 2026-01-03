export type UserRole = 'super_admin' | 'cell_leader';
export type MaritalStatus = 'single' | 'married' | 'undisclosed';
export type MemberStatus = 'pending_approval' | 'active' | 'inactive';
export type FollowUpType = 'visit' | 'call' | 'message';
export type ServiceType = 'sunday' | 'midweek' | 'cell_meeting';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type NotificationType = 'birthday' | 'reminder' | 'approval';
export type MemberJourneyStatus = 'new' | 'contacted' | 'engaged' | 'foundation' | 'active_member' | 'potential_leader';

export interface User {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

export interface CellGroup {
  id: number;
  name: string;
  description: string | null;
  leader_id: number | null;
  leader_name?: string;
  leader_email?: string;
  member_count?: number;
  created_at: string;
}

export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  birthday: string | null;
  marital_status: MaritalStatus;
  brought_by: string | null;
  date_joined: string;
  cell_group_id: number | null;
  cell_group_name?: string;
  assigned_leader_id: number | null;
  leader_name?: string;
  foundation_school_completed: boolean;
  foundation_school_date: string | null;
  status: MemberStatus;
  journey_status: MemberJourneyStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  follow_up_count?: number;
  last_follow_up?: string | null;
}

export interface FollowUp {
  id: number;
  member_id: number;
  leader_id: number;
  leader_name?: string;
  type: FollowUpType;
  notes: string | null;
  follow_up_date: string;
  created_at: string;
}

export interface Attendance {
  id: number;
  member_id: number;
  service_date: string;
  service_type: ServiceType;
  attended: boolean;
  created_at: string;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

export interface PendingApproval {
  id: number;
  member_id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  requested_by: number;
  requested_by_name?: string;
  status: ApprovalStatus;
  reviewed_by: number | null;
  reviewed_by_name?: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface DashboardStats {
  activeMembers: number;
  pendingApprovals: number;
  needFollowUp: number;
  upcomingBirthdays: number;
  totalMembers?: number;
  totalCellGroups?: number;
  totalLeaders?: number;
  membersWithoutCell?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}
