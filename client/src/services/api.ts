import api from './api';
import type { Member } from '../types';

export interface MembersQuery {
  status?: string;
  cell_group_id?: number;
  journey_status?: string;
  search?: string;
}

export const membersApi = {
  /**
   * Get all members with optional filters
   */
  getAll: (params?: MembersQuery) =>
    api.get<Member[]>('/members', {
      params,
    }),

  /**
   * Get a single member by ID
   */
  getOne: (id: number) =>
    api.get<Member>(`/members/${id}`),

  /**
   * Create a new member
   */
  create: (data: Partial<Member>) =>
    api.post<Member>('/members', data),

  /**
   * Update an existing member
   */
  update: (id: number, data: Partial<Member>) =>
    api.put<Member>(`/members/${id}`, data),

  /**
   * Delete a member
   */
  delete: (id: number) =>
    api.delete(`/members/${id}`),

  /**
   * Update member journey status only
   */
  updateJourney: (id: number, journey_status: string) =>
    api.patch(`/members/${id}/journey`, { journey_status }),

  /**
   * Get upcoming birthdays
   */
  getUpcomingBirthdays: (days: number = 7) =>
    api.get<Member[]>('/members/birthdays/upcoming', {
      params: { days },
    }),
};

export default membersApi;