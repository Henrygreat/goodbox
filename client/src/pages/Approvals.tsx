import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { approvalsApi, cellgroupsApi, authApi } from '../services/api';
import type { PendingApproval, CellGroup, User } from '../types';

export default function Approvals() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [leaders, setLeaders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [assignData, setAssignData] = useState({
    cell_group_id: '',
    assigned_leader_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [approvalsRes, groupsRes, leadersRes] = await Promise.all([
        approvalsApi.getAll('pending'),
        cellgroupsApi.getAll(),
        authApi.getUsers()
      ]);
      setApprovals(approvalsRes.data);
      setCellGroups(groupsRes.data);
      setLeaders(leadersRes.data);
    } catch (error) {
      console.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (approval: PendingApproval) => {
    try {
      await approvalsApi.approve(approval.id, {
        cell_group_id: assignData.cell_group_id ? parseInt(assignData.cell_group_id) : undefined,
        assigned_leader_id: assignData.assigned_leader_id ? parseInt(assignData.assigned_leader_id) : undefined
      });
      setSelectedApproval(null);
      setAssignData({ cell_group_id: '', assigned_leader_id: '' });
      loadData();
    } catch (error) {
      console.error('Failed to approve member');
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt('Reason for rejection (optional):');
    try {
      await approvalsApi.reject(id, reason || undefined);
      loadData();
    } catch (error) {
      console.error('Failed to reject member');
    }
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Pending Approvals</h1>
        <span className="bg-orange-100 text-orange-800 px-4 py-2 rounded-full font-medium">
          {approvals.length} pending
        </span>
      </div>

      {approvals.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">All caught up!</h2>
          <p className="text-gray-500">No pending member approvals at this time.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {approvals.map((approval) => (
            <div key={approval.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    {approval.first_name} {approval.last_name}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm text-gray-600">
                    {approval.email && <p>Email: {approval.email}</p>}
                    {approval.phone && <p>Phone: {approval.phone}</p>}
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    Submitted by: <strong>{approval.requested_by_name}</strong>
                    <span className="mx-2">•</span>
                    {new Date(approval.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedApproval(approval)}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(approval.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                  >
                    Reject
                  </button>
                  <Link
                    to={`/members/${approval.member_id}`}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    View Details
                  </Link>
                </div>
              </div>

              {/* Approval Modal */}
              {selectedApproval?.id === approval.id && (
                <div className="mt-6 pt-6 border-t">
                  <h4 className="font-medium text-gray-800 mb-4">Assign to cell group and leader (optional)</h4>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Cell Group</label>
                      <select
                        value={assignData.cell_group_id}
                        onChange={(e) => setAssignData({ ...assignData, cell_group_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select cell group...</option>
                        {cellGroups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Leader</label>
                      <select
                        value={assignData.assigned_leader_id}
                        onChange={(e) => setAssignData({ ...assignData, assigned_leader_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">Select leader...</option>
                        {leaders.map((leader) => (
                          <option key={leader.id} value={leader.id}>
                            {leader.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(approval)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Confirm Approval
                    </button>
                    <button
                      onClick={() => {
                        setSelectedApproval(null);
                        setAssignData({ cell_group_id: '', assigned_leader_id: '' });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
