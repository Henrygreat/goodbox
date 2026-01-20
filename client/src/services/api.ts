import axios from 'axios';
import type {
  User,
  Member,
  CellGroup,
  FollowUp,
  Attendance,
  Notification,
  PendingApproval,
  DashboardStats,
  AuthResponse,
  ImportRecord,
  ImportParseResult,
  ImportCommitResult,
  ImportCommitOptions
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),

  getMe: () => api.get<User>('/auth/me'),

  getUsers: () => api.get<User[]>('/auth/users'),

  createUser: (data: { email: string; password: string; name: string; phone?: string }) =>
    api.post<User>('/auth/users', data),

  updateUser: (id: number, data: Partial<User & { password?: string }>) =>
    api.put<User>(`/auth/users/${id}`, data),

  deleteUser: (id: number) => api.delete(`/auth/users/${id}`)
};

// Members
export const membersApi = {
  getAll: (params?: {
    status?: string;
    cell_group_id?: number;
    search?: string;
    journey_status?: string;
  }) => api.get<Member[]>('/members', { params }),

  getOne: (id: number) => api.get<Member>(`/members/${id}`),

  create: (data: Partial<Member>) => api.post<Member>('/members', data),

  update: (id: number, data: Partial<Member>) =>
    api.put<Member>(`/members/${id}`, data),

  delete: (id: number) => api.delete(`/members/${id}`),

  updateJourney: (id: number, journey_status: string) =>
    api.patch<Member>(`/members/${id}/journey`, { journey_status }),

  getUpcomingBirthdays: (days?: number) =>
    api.get<Member[]>('/members/birthdays/upcoming', { params: { days } })
};

// Follow-ups
export const followupsApi = {
  getByMember: (memberId: number) =>
    api.get<FollowUp[]>(`/followups/member/${memberId}`),

  getByLeader: (leaderId: number) =>
    api.get<FollowUp[]>(`/followups/leader/${leaderId}`),

  getPending: (days?: number) =>
    api.get<Member[]>('/followups/pending', { params: { days } }),

  create: (data: {
    member_id: number;
    type: string;
    notes?: string;
    follow_up_date: string;
  }) => api.post<FollowUp>('/followups', data),

  update: (id: number, data: Partial<FollowUp>) =>
    api.put<FollowUp>(`/followups/${id}`, data),

  delete: (id: number) => api.delete(`/followups/${id}`)
};

// Cell Groups
export const cellgroupsApi = {
  getAll: () => api.get<CellGroup[]>('/cellgroups'),

  getOne: (id: number) =>
    api.get<CellGroup & { members: Member[] }>(`/cellgroups/${id}`),

  create: (data: { name: string; description?: string; leader_id?: number }) =>
    api.post<CellGroup>('/cellgroups', data),

  update: (id: number, data: Partial<CellGroup>) =>
    api.put<CellGroup>(`/cellgroups/${id}`, data),

  delete: (id: number) => api.delete(`/cellgroups/${id}`),

  assignMembers: (id: number, member_ids: number[]) =>
    api.post(`/cellgroups/${id}/members`, { member_ids })
};

// Attendance
export const attendanceApi = {
  getByMember: (memberId: number, limit?: number) =>
    api.get<Attendance[]>(`/attendance/member/${memberId}`, { params: { limit } }),

  getByDate: (date: string, service_type?: string) =>
    api.get<Attendance[]>(`/attendance/date/${date}`, { params: { service_type } }),

  mark: (data: {
    member_id: number;
    service_date: string;
    service_type: string;
    attended?: boolean;
  }) => api.post('/attendance', data),

  markBulk: (data: {
    service_date: string;
    service_type: string;
    attendees: { member_id: number; attended: boolean }[];
  }) => api.post('/attendance/bulk', data),

  getStats: (start_date?: string, end_date?: string) =>
    api.get('/attendance/stats', { params: { start_date, end_date } })
};

// Approvals
export const approvalsApi = {
  getAll: (status?: string) =>
    api.get<PendingApproval[]>('/approvals', { params: { status } }),

  approve: (id: number, data?: { assigned_leader_id?: number; cell_group_id?: number }) =>
    api.post(`/approvals/${id}/approve`, data),

  reject: (id: number, reason?: string) =>
    api.post(`/approvals/${id}/reject`, { reason }),

  getStats: () => api.get('/approvals/stats')
};

// Notifications
export const notificationsApi = {
  getAll: (unread_only?: boolean) =>
    api.get<Notification[]>('/notifications', { params: { unread_only } }),

  getUnreadCount: () => api.get<{ count: number }>('/notifications/unread-count'),

  markRead: (id: number) => api.patch(`/notifications/${id}/read`),

  markAllRead: () => api.patch('/notifications/read-all'),

  delete: (id: number) => api.delete(`/notifications/${id}`),

  checkBirthdays: () => api.post('/notifications/check-birthdays')
};

// Reports
export const reportsApi = {
  getDashboard: () => api.get<DashboardStats>('/reports/dashboard'),

  getMembersByStatus: () => api.get('/reports/members-by-status'),

  getFollowupRates: (days?: number) =>
    api.get('/reports/followup-rates', { params: { days } }),

  getCellGroupHealth: () => api.get('/reports/cell-group-health'),

  getNewMembersTrend: (months?: number) =>
    api.get('/reports/new-members-trend', { params: { months } }),

  getFoundationSchool: () => api.get('/reports/foundation-school')
};

// Password management
export const passwordApi = {
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, newPassword }),

  adminResetPassword: (userId: number) =>
    api.post<{ message: string; emailSent: boolean; note?: string }>(
      `/admin/users/${userId}/reset-password`
    )
};

// Imports
export const importsApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ importId: number; filename: string }>(
      '/imports/upload',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
  },

  parse: (importId: number, checkDuplicates: boolean = true) =>
    api.post<ImportParseResult>(`/imports/${importId}/parse?checkDuplicates=${checkDuplicates}`),

  commit: (importId: number, options?: ImportCommitOptions) =>
    api.post<ImportCommitResult>(`/imports/${importId}/commit`, options),

  getStatus: (importId: number) =>
    api.get<ImportRecord>(`/imports/${importId}`),

  list: () => api.get<ImportRecord[]>('/imports'),

  downloadTemplate: () =>
    api.get('/imports/template', { responseType: 'blob' })
};export type ServiceType = "sunday" | "wednesday";

export type RotaRole =
  | "opening_prayer"
  | "rhapsody_reading"
  | "closing_announcements";

export type RotaAssignmentPayload = {
  role: RotaRole;
  user_id?: number;   // optional (if you select a user)
  name?: string;      // optional (if you type a name)
};

export type RotaPayload = {
  service_date: string;
  service_type: ServiceType;
  notes?: string;
  assignments: RotaAssignmentPayload[];
};

export const rotaApi = {
  getAll: (params?: { service_type?: ServiceType; from?: string; to?: string }) =>
    api.get("/rota", { params }),

  getOne: (id: number) => api.get(`/rota/${id}`),

  create: (data: RotaPayload) => api.post("/rota", data),

  update: (id: number, data: Partial<RotaPayload>) => api.put(`/rota/${id}`, data),

  delete: (id: number) => api.delete(`/rota/${id}`),
};
export default api;