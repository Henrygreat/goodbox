import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { membersApi, followupsApi, attendanceApi } from '../services/api';
import type { Member, FollowUp, Attendance, MemberJourneyStatus, FollowUpType } from '../types';

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFollowUpForm, setShowFollowUpForm] = useState(false);
  const [followUpData, setFollowUpData] = useState({
    type: 'call' as FollowUpType,
    notes: '',
    follow_up_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [memberRes, followUpsRes, attendanceRes] = await Promise.all([
        membersApi.getOne(parseInt(id!)),
        followupsApi.getByMember(parseInt(id!)),
        attendanceApi.getByMember(parseInt(id!), 10)
      ]);
      setMember(memberRes.data);
      setFollowUps(followUpsRes.data);
      setAttendance(attendanceRes.data);
    } catch (error) {
      console.error('Failed to load member');
      navigate('/members');
    } finally {
      setLoading(false);
    }
  };

  const handleAddFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await followupsApi.create({
        member_id: parseInt(id!),
        ...followUpData
      });
      setShowFollowUpForm(false);
      setFollowUpData({ type: 'call', notes: '', follow_up_date: new Date().toISOString().split('T')[0] });
      loadData();
    } catch (error) {
      console.error('Failed to add follow-up');
    }
  };

  const handleUpdateJourney = async (status: MemberJourneyStatus) => {
    try {
      await membersApi.updateJourney(parseInt(id!), status);
      loadData();
    } catch (error) {
      console.error('Failed to update journey status');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this member?')) return;
    try {
      await membersApi.delete(parseInt(id!));
      navigate('/members');
    } catch (error) {
      console.error('Failed to delete member');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!member) return null;

  const journeySteps: { status: MemberJourneyStatus; label: string }[] = [
    { status: 'new', label: 'New' },
    { status: 'contacted', label: 'Contacted' },
    { status: 'engaged', label: 'Engaged' },
    { status: 'foundation', label: 'Foundation' },
    { status: 'active_member', label: 'Active' },
    { status: 'potential_leader', label: 'Leader' }
  ];

  const currentJourneyIndex = journeySteps.findIndex(s => s.status === member.journey_status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/members" className="text-gray-500 hover:text-gray-700">
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            {member.first_name} {member.last_name}
          </h1>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            member.status === 'active' ? 'bg-green-100 text-green-800' :
            member.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {member.status === 'active' ? 'Active' : member.status === 'pending_approval' ? 'Pending' : 'Inactive'}
          </span>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/members/${id}/edit`}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Edit
          </Link>
          {isAdmin && (
            <button
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Journey Progress */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Member Journey</h2>
        <div className="flex items-center justify-between">
          {journeySteps.map((step, index) => (
            <div key={step.status} className="flex-1 flex items-center">
              <button
                onClick={() => handleUpdateJourney(step.status)}
                className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${
                  index <= currentJourneyIndex
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                {index + 1}
              </button>
              {index < journeySteps.length - 1 && (
                <div className={`flex-1 h-1 mx-2 ${
                  index < currentJourneyIndex ? 'bg-primary-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {journeySteps.map((step) => (
            <span key={step.status} className="text-xs text-gray-500">{step.label}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Personal Information</h2>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="font-medium">{member.phone || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="font-medium">{member.email || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Birthday</dt>
                <dd className="font-medium">
                  {member.birthday ? new Date(member.birthday).toLocaleDateString() : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Marital Status</dt>
                <dd className="font-medium capitalize">{member.marital_status}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-sm text-gray-500">Address</dt>
                <dd className="font-medium">{member.address || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Brought By</dt>
                <dd className="font-medium">{member.brought_by || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Date Joined</dt>
                <dd className="font-medium">
                  {new Date(member.date_joined).toLocaleDateString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Cell Group</dt>
                <dd className="font-medium">{member.cell_group_name || 'Not assigned'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Assigned Leader</dt>
                <dd className="font-medium">{member.leader_name || 'Not assigned'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Foundation School</dt>
                <dd className="font-medium">
                  {member.foundation_school_completed ? (
                    <span className="text-green-600">
                      Completed {member.foundation_school_date && `on ${new Date(member.foundation_school_date).toLocaleDateString()}`}
                    </span>
                  ) : (
                    <span className="text-yellow-600">Not completed</span>
                  )}
                </dd>
              </div>
            </dl>
            {member.notes && (
              <div className="mt-4 pt-4 border-t">
                <dt className="text-sm text-gray-500 mb-1">Notes</dt>
                <dd className="text-gray-700">{member.notes}</dd>
              </div>
            )}
          </div>

          {/* Follow-ups */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800">Follow-up History</h2>
              <button
                onClick={() => setShowFollowUpForm(!showFollowUpForm)}
                className="text-primary-600 hover:text-primary-700"
              >
                + Add Follow-up
              </button>
            </div>

            {showFollowUpForm && (
              <form onSubmit={handleAddFollowUp} className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={followUpData.type}
                      onChange={(e) => setFollowUpData({ ...followUpData, type: e.target.value as FollowUpType })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="call">Phone Call</option>
                      <option value="visit">Visit</option>
                      <option value="message">Message</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      value={followUpData.follow_up_date}
                      onChange={(e) => setFollowUpData({ ...followUpData, follow_up_date: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={followUpData.notes}
                    onChange={(e) => setFollowUpData({ ...followUpData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                    placeholder="How did the follow-up go?"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowFollowUpForm(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {followUps.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No follow-ups recorded yet</p>
            ) : (
              <ul className="space-y-4">
                {followUps.map((fu) => (
                  <li key={fu.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      fu.type === 'call' ? 'bg-blue-100' :
                      fu.type === 'visit' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      {fu.type === 'call' ? '📞' : fu.type === 'visit' ? '🏠' : '💬'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{fu.type}</span>
                        <span className="text-sm text-gray-500">
                          {new Date(fu.follow_up_date).toLocaleDateString()}
                        </span>
                      </div>
                      {fu.notes && <p className="text-gray-600 mt-1">{fu.notes}</p>}
                      <p className="text-sm text-gray-500 mt-1">By: {fu.leader_name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Attendance */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Recent Attendance</h2>
            {attendance.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No attendance records</p>
            ) : (
              <ul className="space-y-2">
                {attendance.map((att) => (
                  <li key={att.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <div className="text-sm font-medium">
                        {new Date(att.service_date).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">{att.service_type.replace('_', ' ')}</div>
                    </div>
                    <span className={att.attended ? 'text-green-500' : 'text-red-500'}>
                      {att.attended ? '✓' : '✗'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Follow-ups</span>
                <span className="font-medium">{followUps.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Attendance Rate</span>
                <span className="font-medium">
                  {attendance.length > 0
                    ? Math.round((attendance.filter(a => a.attended).length / attendance.length) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Days as Member</span>
                <span className="font-medium">
                  {Math.floor((Date.now() - new Date(member.date_joined).getTime()) / (1000 * 60 * 60 * 24))}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
