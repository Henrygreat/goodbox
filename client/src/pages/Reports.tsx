import { useState, useEffect } from 'react';
import { reportsApi } from '../services/api';

interface ReportData {
  membersByStatus: { byStatus: any[]; byJourneyStatus: any[] } | null;
  followupRates: any[] | null;
  cellGroupHealth: any[] | null;
  newMembersTrend: any[] | null;
  foundationSchool: any | null;
}

export default function Reports() {
  const [data, setData] = useState<ReportData>({
    membersByStatus: null,
    followupRates: null,
    cellGroupHealth: null,
    newMembersTrend: null,
    foundationSchool: null
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statusRes, followupRes, cellHealthRes, trendRes, foundationRes] = await Promise.all([
        reportsApi.getMembersByStatus(),
        reportsApi.getFollowupRates(30),
        reportsApi.getCellGroupHealth(),
        reportsApi.getNewMembersTrend(6),
        reportsApi.getFoundationSchool()
      ]);

      setData({
        membersByStatus: statusRes.data,
        followupRates: followupRes.data,
        cellGroupHealth: cellHealthRes.data,
        newMembersTrend: trendRes.data,
        foundationSchool: foundationRes.data
      });
    } catch (error) {
      console.error('Failed to load reports');
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

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'followups', label: 'Follow-ups' },
    { id: 'cellgroups', label: 'Cell Groups' },
    { id: 'foundation', label: 'Foundation School' }
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Reports</h1>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && data.membersByStatus && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Members by Status */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Members by Status</h2>
              <div className="space-y-3">
                {data.membersByStatus.byStatus.map((item: any) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <span className="capitalize text-gray-600">{item.status.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-800">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Members by Journey Status */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Members by Journey Stage</h2>
              <div className="space-y-3">
                {data.membersByStatus.byJourneyStatus.map((item: any) => (
                  <div key={item.journey_status} className="flex items-center justify-between">
                    <span className="capitalize text-gray-600">{item.journey_status.replace('_', ' ')}</span>
                    <span className="font-semibold text-gray-800">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* New Members Trend */}
          {data.newMembersTrend && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">New Members Trend (Last 6 Months)</h2>
              <div className="flex items-end gap-4 h-48">
                {data.newMembersTrend.map((item: any) => {
                  const maxCount = Math.max(...data.newMembersTrend!.map((i: any) => i.count));
                  const height = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  return (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-2">
                      <div
                        className="w-full bg-primary-500 rounded-t transition-all"
                        style={{ height: `${height}%`, minHeight: item.count > 0 ? '20px' : '4px' }}
                      />
                      <span className="text-xs text-gray-500">{item.month}</span>
                      <span className="text-sm font-medium text-gray-700">{item.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Follow-ups Tab */}
      {activeTab === 'followups' && data.followupRates && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Cell Leader Follow-up Activity (Last 30 Days)</h2>
          {data.followupRates.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No cell leaders found</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned Members</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Follow-ups</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members Contacted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Coverage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.followupRates.map((leader: any) => {
                  const coverage = leader.assigned_members > 0
                    ? Math.round((leader.members_contacted / leader.assigned_members) * 100)
                    : 0;
                  return (
                    <tr key={leader.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">{leader.name}</td>
                      <td className="px-4 py-3 text-gray-600">{leader.assigned_members}</td>
                      <td className="px-4 py-3 text-gray-600">{leader.follow_ups_count}</td>
                      <td className="px-4 py-3 text-gray-600">{leader.members_contacted}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                coverage >= 80 ? 'bg-green-500' :
                                coverage >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${coverage}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{coverage}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Cell Groups Tab */}
      {activeTab === 'cellgroups' && data.cellGroupHealth && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Cell Group Health</h2>
          {data.cellGroupHealth.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No cell groups found</p>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cell Group</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Members</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.cellGroupHealth.map((group: any) => (
                  <tr key={group.id}>
                    <td className="px-4 py-3 font-medium text-gray-800">{group.name}</td>
                    <td className="px-4 py-3 text-gray-600">{group.leader_name || 'Not assigned'}</td>
                    <td className="px-4 py-3 text-gray-600">{group.member_count}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {group.last_activity
                        ? new Date(group.last_activity).toLocaleDateString()
                        : 'No activity'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Foundation School Tab */}
      {activeTab === 'foundation' && data.foundationSchool && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <div className="text-3xl font-bold text-green-600">{data.foundationSchool.completed}</div>
              <div className="text-gray-500">Completed</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <div className="text-3xl font-bold text-yellow-600">{data.foundationSchool.notCompleted}</div>
              <div className="text-gray-500">Not Completed</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 text-center">
              <div className="text-3xl font-bold text-primary-600">{data.foundationSchool.completionRate}%</div>
              <div className="text-gray-500">Completion Rate</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Members Needing Foundation School (Joined 30+ days ago)
            </h2>
            {data.foundationSchool.needsFoundation.length === 0 ? (
              <p className="text-gray-500 text-center py-8">All members have completed foundation school!</p>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Joined</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cell Group</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Leader</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {data.foundationSchool.needsFoundation.map((member: any) => (
                    <tr key={member.id}>
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {member.first_name} {member.last_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(member.date_joined).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{member.cell_group_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{member.leader_name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
