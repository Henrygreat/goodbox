import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { membersApi, cellgroupsApi } from '../services/api';
import type { Member, CellGroup, MemberStatus, MemberJourneyStatus } from '../types';

export default function Members() {
  const [members, setMembers] = useState<Member[]>([]);
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | ''>('');
  const [cellGroupFilter, setCellGroupFilter] = useState<string>('');
  const [journeyFilter, setJourneyFilter] = useState<MemberJourneyStatus | ''>('');

  useEffect(() => {
    loadData();
  }, [statusFilter, cellGroupFilter, journeyFilter]);

  const loadData = async () => {
    try {
      const [membersRes, groupsRes] = await Promise.all([
        membersApi.getAll({
          status: statusFilter || undefined,
          cell_group_id: cellGroupFilter ? parseInt(cellGroupFilter) : undefined,
          journey_status: journeyFilter || undefined
        }),
        cellgroupsApi.getAll()
      ]);
      setMembers(membersRes.data);
      setCellGroups(groupsRes.data);
    } catch (error) {
      console.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter(member => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      member.first_name.toLowerCase().includes(searchLower) ||
      member.last_name.toLowerCase().includes(searchLower) ||
      member.email?.toLowerCase().includes(searchLower) ||
      member.phone?.includes(search)
    );
  });

  const getStatusBadge = (status: MemberStatus) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      pending_approval: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800'
    };
    const labels = {
      active: 'Active',
      pending_approval: 'Pending',
      inactive: 'Inactive'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const getJourneyBadge = (status: MemberJourneyStatus) => {
    const styles: Record<MemberJourneyStatus, string> = {
      new: 'bg-blue-100 text-blue-800',
      contacted: 'bg-cyan-100 text-cyan-800',
      engaged: 'bg-indigo-100 text-indigo-800',
      foundation: 'bg-purple-100 text-purple-800',
      active_member: 'bg-green-100 text-green-800',
      potential_leader: 'bg-yellow-100 text-yellow-800'
    };
    const labels: Record<MemberJourneyStatus, string> = {
      new: 'New',
      contacted: 'Contacted',
      engaged: 'Engaged',
      foundation: 'Foundation',
      active_member: 'Active Member',
      potential_leader: 'Potential Leader'
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Members</h1>
        <Link
          to="/members/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors text-center text-sm sm:text-base"
        >
          + Add Member
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <input
            type="text"
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MemberStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_approval">Pending Approval</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={cellGroupFilter}
            onChange={(e) => setCellGroupFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
          >
            <option value="">All Cell Groups</option>
            {cellGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <select
            value={journeyFilter}
            onChange={(e) => setJourneyFilter(e.target.value as MemberJourneyStatus | '')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
          >
            <option value="">All Journey Stages</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="engaged">Engaged</option>
            <option value="foundation">Foundation School</option>
            <option value="active_member">Active Member</option>
            <option value="potential_leader">Potential Leader</option>
          </select>
        </div>
      </div>

      {/* Members - Card view for mobile, Table for desktop */}
      {filteredMembers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          No members found
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredMembers.map((member) => (
              <Link
                key={member.id}
                to={`/members/${member.id}`}
                className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900">
                      {member.first_name} {member.last_name}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {member.phone || member.email || 'No contact'}
                    </div>
                    {member.cell_group_name && (
                      <div className="text-xs text-gray-400 mt-1">
                        {member.cell_group_name}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(member.status)}
                    {getJourneyBadge(member.journey_status)}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  <span>
                    {member.birthday && `🎂 ${new Date(member.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                  </span>
                  <span>
                    Follow-up: {member.last_follow_up ? new Date(member.last_follow_up).toLocaleDateString() : 'Never'}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cell Group
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Journey
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Follow-up
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <Link to={`/members/${member.id}`} className="hover:text-primary-600">
                          <div className="font-medium text-gray-900">
                            {member.first_name} {member.last_name}
                          </div>
                          {member.birthday && (
                            <div className="text-sm text-gray-500">
                              🎂 {new Date(member.birthday).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{member.phone || '-'}</div>
                        <div className="text-sm text-gray-500">{member.email || '-'}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {member.cell_group_name || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(member.status)}
                      </td>
                      <td className="px-6 py-4">
                        {getJourneyBadge(member.journey_status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {member.last_follow_up
                          ? new Date(member.last_follow_up).toLocaleDateString()
                          : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <div className="text-sm text-gray-500">
        Showing {filteredMembers.length} of {members.length} members
      </div>
    </div>
  );
}
