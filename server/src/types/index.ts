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
  password_hash: string;
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
  assigned_leader_id: number | null;
  foundation_school_completed: boolean;
  foundation_school_date: string | null;
  status: MemberStatus;
  journey_status: MemberJourneyStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  id: number;
  member_id: number;
  leader_id: number;
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
  requested_by: number;
  status: ApprovalStatus;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface AuthPayload {
  userId: number;
  email: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CreateMemberRequest {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  address?: string;
  birthday?: string;
  marital_status: MaritalStatus;
  brought_by?: string;
  cell_group_id?: number;
  notes?: string;
}

export interface CreateFollowUpRequest {
  member_id: number;
  type: FollowUpType;
  notes?: string;
  follow_up_date: string;
}

export interface CreateCellGroupRequest {
  name: string;
  description?: string;
  leader_id?: number;
}
