import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cellgroupsApi } from '../services/api';
import type { CellGroup, Member } from '../types';

export default function CellGroupDetail() {
  const { id } = useParams<{ id: string }>();
  const [cellGroup, setCellGroup] = useState<(CellGroup & { members: Member[] }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const res = await cellgroupsApi.getOne(parseInt(id!));
      setCellGroup(res.data);
    } catch (error) {
      console.error('Failed to load cell group');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!cellGroup) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/cell-groups" className="text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">{cellGroup.name}</h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            {cellGroup.description && (
              <p className="text-gray-600">{cellGroup.description}</p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Leader: {cellGroup.leader_name || 'Not assigned'}
              {cellGroup.leader_email && ` (${cellGroup.leader_email})`}
            </p>
          </div>
          <span className="bg-primary-100 text-primary-800 px-4 py-2 rounded-full font-medium">
            {cellGroup.members?.length || 0} members
          </span>
        </div>

        <h2 className="text-lg font-semibold text-gray-800 mb-4">Members</h2>

        {cellGroup.members?.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No members in this cell group</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Follow-up</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Journey</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cellGroup.members?.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link to={`/members/${member.id}`} className="hover:text-primary-600">
                        <div className="font-medium">{member.first_name} {member.last_name}</div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <div>{member.phone || '-'}</div>
                      <div>{member.email || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {member.last_follow_up
                        ? new Date(member.last_follow_up).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {member.journey_status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
