import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { reportsApi, followupsApi, membersApi } from '../services/api';
import type { DashboardStats, Member } from '../types';

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [needFollowUp, setNeedFollowUp] = useState<Member[]>([]);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, followUpRes, birthdaysRes] = await Promise.all([
        reportsApi.getDashboard(),
        followupsApi.getPending(7),
        membersApi.getUpcomingBirthdays(7)
      ]);
      setStats(statsRes.data);
      setNeedFollowUp(followUpRes.data.slice(0, 5));
      setUpcomingBirthdays(birthdaysRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data');
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

  const statCards = [
    { label: 'Active Members', value: stats?.activeMembers || 0, color: 'bg-blue-500', icon: '👥', link: '/members' },
    { label: 'Need Follow-up', value: stats?.needFollowUp || 0, color: 'bg-yellow-500', icon: '📞', link: '/members' },
    { label: 'Upcoming Birthdays', value: stats?.upcomingBirthdays || 0, color: 'bg-pink-500', icon: '🎂', link: '/members' },
    ...(isAdmin ? [
      { label: 'Pending Approvals', value: stats?.pendingApprovals || 0, color: 'bg-orange-500', icon: '✅', link: '/approvals' },
      { label: 'Total Members', value: stats?.totalMembers || 0, color: 'bg-green-500', icon: '📊', link: '/reports' },
      { label: 'Cell Groups', value: stats?.totalCellGroups || 0, color: 'bg-purple-500', icon: '🏠', link: '/cell-groups' },
      { label: 'Cell Leaders', value: stats?.totalLeaders || 0, color: 'bg-indigo-500', icon: '👤', link: '/users' },
      { label: 'Without Cell Group', value: stats?.membersWithoutCell || 0, color: 'bg-red-500', icon: '⚠️', link: '/members' },
    ] : [])
  ];

  const formatBirthday = (birthday: string) => {
    const date = new Date(birthday);
    const today = new Date();
    date.setFullYear(today.getFullYear());
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today!';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <Link
          to="/members/new"
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
        >
          + Add Member
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.link}
            className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">{card.label}</p>
                <p className="text-3xl font-bold text-gray-800 mt-1">{card.value}</p>
              </div>
              <div className={`${card.color} text-white p-3 rounded-lg text-2xl`}>
                {card.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Members Needing Follow-up */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Need Follow-up</h2>
            <Link to="/members" className="text-primary-600 text-sm hover:underline">
              View all
            </Link>
          </div>
          {needFollowUp.length === 0 ? (
            <p className="text-gray-500 text-center py-8">All members are followed up!</p>
          ) : (
            <ul className="space-y-3">
              {needFollowUp.map((member) => (
                <li key={member.id}>
                  <Link
                    to={`/members/${member.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-800">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {member.last_follow_up
                          ? `Last: ${new Date(member.last_follow_up).toLocaleDateString()}`
                          : 'Never contacted'}
                      </p>
                    </div>
                    <span className="text-yellow-500">📞</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming Birthdays */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Upcoming Birthdays</h2>
            <span className="text-2xl">🎂</span>
          </div>
          {upcomingBirthdays.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No birthdays this week</p>
          ) : (
            <ul className="space-y-3">
              {upcomingBirthdays.map((member) => (
                <li key={member.id}>
                  <Link
                    to={`/members/${member.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-800">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {member.birthday && new Date(member.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-pink-500 font-medium text-sm">
                      {member.birthday && formatBirthday(member.birthday)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            to="/members/new"
            className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-3xl mb-2">➕</span>
            <span className="text-sm text-gray-600">Add Member</span>
          </Link>
          <Link
            to="/attendance"
            className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-3xl mb-2">✓</span>
            <span className="text-sm text-gray-600">Mark Attendance</span>
          </Link>
          <Link
            to="/cell-groups"
            className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
          >
            <span className="text-3xl mb-2">🏠</span>
            <span className="text-sm text-gray-600">View Cell Groups</span>
          </Link>
          {isAdmin && (
            <Link
              to="/reports"
              className="flex flex-col items-center p-4 rounded-lg border-2 border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors"
            >
              <span className="text-3xl mb-2">📈</span>
              <span className="text-sm text-gray-600">View Reports</span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
