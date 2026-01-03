import { useState, useEffect } from 'react';
import { membersApi, attendanceApi } from '../services/api';
import type { Member, ServiceType } from '../types';

export default function Attendance() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [serviceType, setServiceType] = useState<ServiceType>('sunday');
  const [attendance, setAttendance] = useState<Record<number, boolean>>({});
  const [existingRecords, setExistingRecords] = useState<Record<number, boolean>>({});

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    loadAttendance();
  }, [date, serviceType]);

  const loadMembers = async () => {
    try {
      const res = await membersApi.getAll({ status: 'active' });
      setMembers(res.data);
    } catch (error) {
      console.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  const loadAttendance = async () => {
    try {
      const res = await attendanceApi.getByDate(date, serviceType);
      const records: Record<number, boolean> = {};
      res.data.forEach((a: any) => {
        records[a.member_id] = a.attended;
      });
      setExistingRecords(records);
      setAttendance(records);
    } catch (error) {
      console.error('Failed to load attendance');
    }
  };

  const toggleAttendance = (memberId: number) => {
    setAttendance((prev) => ({
      ...prev,
      [memberId]: !prev[memberId]
    }));
  };

  const markAllPresent = () => {
    const all: Record<number, boolean> = {};
    members.forEach((m) => (all[m.id] = true));
    setAttendance(all);
  };

  const markAllAbsent = () => {
    const all: Record<number, boolean> = {};
    members.forEach((m) => (all[m.id] = false));
    setAttendance(all);
  };

  const saveAttendance = async () => {
    setSaving(true);
    try {
      const attendees = Object.entries(attendance).map(([id, attended]) => ({
        member_id: parseInt(id),
        attended
      }));

      await attendanceApi.markBulk({
        service_date: date,
        service_type: serviceType,
        attendees
      });

      loadAttendance();
      alert('Attendance saved successfully!');
    } catch (error) {
      console.error('Failed to save attendance');
      alert('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const hasChanges = JSON.stringify(attendance) !== JSON.stringify(existingRecords);

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
        <h1 className="text-2xl font-bold text-gray-800">Attendance</h1>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value as ServiceType)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="sunday">Sunday Service</option>
              <option value="midweek">Midweek Service</option>
              <option value="cell_meeting">Cell Meeting</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={markAllPresent}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
            >
              All Present
            </button>
            <button
              onClick={markAllAbsent}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
            >
              All Absent
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={saveAttendance}
              disabled={saving || !hasChanges}
              className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600">
          <span>Present: <strong className="text-green-600">{presentCount}</strong></span>
          <span>Absent: <strong className="text-red-600">{members.length - presentCount}</strong></span>
          <span>Total: <strong>{members.length}</strong></span>
          {hasChanges && <span className="text-yellow-600">• Unsaved changes</span>}
        </div>
      </div>

      {/* Attendance Grid */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {members.map((member) => (
            <button
              key={member.id}
              onClick={() => toggleAttendance(member.id)}
              className={`p-4 rounded-lg border-2 transition-all ${
                attendance[member.id]
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${
                  attendance[member.id]
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {attendance[member.id] ? '✓' : ''}
                </div>
                <div className="text-left">
                  <div className="font-medium text-gray-800 text-sm">
                    {member.first_name} {member.last_name.charAt(0)}.
                  </div>
                  {member.cell_group_name && (
                    <div className="text-xs text-gray-500">{member.cell_group_name}</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {members.length === 0 && (
          <p className="text-gray-500 text-center py-12">No active members found</p>
        )}
      </div>
    </div>
  );
}
