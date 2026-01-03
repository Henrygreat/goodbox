import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { cellgroupsApi, authApi } from '../services/api';
import type { CellGroup, User } from '../types';

export default function CellGroups() {
  const { isAdmin } = useAuth();
  const [cellGroups, setCellGroups] = useState<CellGroup[]>([]);
  const [leaders, setLeaders] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    leader_id: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [groupsRes, leadersRes] = await Promise.all([
        cellgroupsApi.getAll(),
        isAdmin ? authApi.getUsers() : Promise.resolve({ data: [] })
      ]);
      setCellGroups(groupsRes.data);
      setLeaders(leadersRes.data);
    } catch (error) {
      console.error('Failed to load cell groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = {
        name: formData.name,
        description: formData.description || undefined,
        leader_id: formData.leader_id ? parseInt(formData.leader_id) : undefined
      };

      if (editingId) {
        await cellgroupsApi.update(editingId, data);
      } else {
        await cellgroupsApi.create(data);
      }

      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', description: '', leader_id: '' });
      loadData();
    } catch (error) {
      console.error('Failed to save cell group');
    }
  };

  const handleEdit = (group: CellGroup) => {
    setEditingId(group.id);
    setFormData({
      name: group.name,
      description: group.description || '',
      leader_id: group.leader_id?.toString() || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure? Members in this group will be unassigned.')) return;
    try {
      await cellgroupsApi.delete(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete cell group');
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
        <h1 className="text-2xl font-bold text-gray-800">Cell Groups</h1>
        {isAdmin && (
          <button
            onClick={() => {
              setEditingId(null);
              setFormData({ name: '', description: '', leader_id: '' });
              setShowForm(true);
            }}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
          >
            + Add Cell Group
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showForm && isAdmin && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-4">
            {editingId ? 'Edit Cell Group' : 'New Cell Group'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leader</label>
                <select
                  value={formData.leader_id}
                  onChange={(e) => setFormData({ ...formData, leader_id: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">No leader assigned</option>
                  {leaders.map((leader) => (
                    <option key={leader.id} value={leader.id}>
                      {leader.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cell Groups Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cellGroups.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-xl shadow-sm">
            <p className="text-gray-500">No cell groups found</p>
          </div>
        ) : (
          cellGroups.map((group) => (
            <div key={group.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                  {group.description && (
                    <p className="text-sm text-gray-500 mt-1">{group.description}</p>
                  )}
                </div>
                <span className="bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm font-medium">
                  {group.member_count || 0} members
                </span>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <span>👤</span>
                  <span>Leader: {group.leader_name || 'Not assigned'}</span>
                </div>

                <div className="flex gap-2">
                  <Link
                    to={`/cell-groups/${group.id}`}
                    className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                  >
                    View Members
                  </Link>
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => handleEdit(group)}
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
