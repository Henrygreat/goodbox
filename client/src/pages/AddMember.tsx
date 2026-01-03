import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { membersApi, cellgroupsApi, authApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { CellGroup, User, MaritalStatus } from '../types';

export default function AddMember() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const isEditing = !!id;

  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [leaders, setLeaders] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    birthday: '',
    marital_status: 'undisclosed' as MaritalStatus,
    brought_by: '',
    cell_group_id: '',
    assigned_leader_id: '',
    foundation_school_completed: false,
    foundation_school_date: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [groupsRes] = await Promise.all([
        cellgroupsApi.getAll(),
        ...(isAdmin ? [authApi.getUsers()] : [])
      ]);
      setCellGroups(groupsRes.data);

      if (isAdmin) {
        const leadersRes = await authApi.getUsers();
        setLeaders(leadersRes.data);
      }

      if (isEditing) {
        const memberRes = await membersApi.getOne(parseInt(id!));
        const member = memberRes.data;
        setFormData({
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email || '',
          phone: member.phone || '',
          address: member.address || '',
          birthday: member.birthday || '',
          marital_status: member.marital_status,
          brought_by: member.brought_by || '',
          cell_group_id: member.cell_group_id?.toString() || '',
          assigned_leader_id: member.assigned_leader_id?.toString() || '',
          foundation_school_completed: member.foundation_school_completed,
          foundation_school_date: member.foundation_school_date || '',
          notes: member.notes || ''
        });
      }
    } catch (error) {
      console.error('Failed to load data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = {
        ...formData,
        cell_group_id: formData.cell_group_id ? parseInt(formData.cell_group_id) : undefined,
        assigned_leader_id: formData.assigned_leader_id ? parseInt(formData.assigned_leader_id) : undefined,
        birthday: formData.birthday || undefined,
        foundation_school_date: formData.foundation_school_date || undefined
      };

      if (isEditing) {
        await membersApi.update(parseInt(id!), data);
        navigate(`/members/${id}`);
      } else {
        const res = await membersApi.create(data);
        navigate(`/members/${res.data.id}`);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link to={isEditing ? `/members/${id}` : '/members'} className="text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">
          {isEditing ? 'Edit Member' : 'Add New Member'}
        </h1>
      </div>

      {!isAdmin && !isEditing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <p className="text-yellow-800">
            As a cell leader, new members you add will require approval from an admin before they become active.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              First Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
            <input
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Marital Status</label>
            <select
              value={formData.marital_status}
              onChange={(e) => setFormData({ ...formData, marital_status: e.target.value as MaritalStatus })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="undisclosed">Prefer not to say</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Who Brought Them</label>
          <input
            type="text"
            value={formData.brought_by}
            onChange={(e) => setFormData({ ...formData, brought_by: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Name of person who invited them"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cell Group</label>
            <select
              value={formData.cell_group_id}
              onChange={(e) => setFormData({ ...formData, cell_group_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Not assigned</option>
              {cellGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Leader</label>
              <select
                value={formData.assigned_leader_id}
                onChange={(e) => setFormData({ ...formData, assigned_leader_id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Not assigned</option>
                {leaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {isEditing && (
          <div className="border-t pt-4">
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.foundation_school_completed}
                  onChange={(e) => setFormData({ ...formData, foundation_school_completed: e.target.checked })}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Foundation School Completed</span>
              </label>
            </div>
            {formData.foundation_school_completed && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Completion Date</label>
                <input
                  type="date"
                  value={formData.foundation_school_date}
                  onChange={(e) => setFormData({ ...formData, foundation_school_date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            rows={3}
            placeholder="Any additional notes about this member"
          />
        </div>

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-primary-600 text-white py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Saving...' : (isEditing ? 'Update Member' : 'Add Member')}
          </button>
          <Link
            to={isEditing ? `/members/${id}` : '/members'}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-center"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
