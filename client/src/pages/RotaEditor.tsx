import { useEffect, useMemo, useState } from "react";
import api, { rotaApi, type RotaRole, type ServiceType } from "../services/api";

type User = { id: number; name: string };

const ROLES: { key: RotaRole; label: string }[] = [
  { key: "opening_prayer", label: "Opening Prayer" },
  { key: "rhapsody_reading", label: "Rhapsody Reading" },
  { key: "closing_announcements", label: "Closing / Announcements" },
];

type AssignmentState = Record<RotaRole, { user_id?: number; name?: string }>;

export default function RotaEditor() {
  const [serviceDate, setServiceDate] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("sunday");
  const [notes, setNotes] = useState("");

  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);

  const [assignments, setAssignments] = useState<AssignmentState>({
    opening_prayer: {},
    rhapsody_reading: {},
    closing_announcements: {},
  });

  useEffect(() => {
    // Your API requires token; this will work for admin
    api
      .get<User[]>("/auth/users")
      .then((res) => setUsers(res.data))
      .catch(console.error);
  }, []);

  const handleUserSelect = (role: RotaRole, userIdRaw: string) => {
    const userId = userIdRaw ? parseInt(userIdRaw, 10) : undefined;

    setAssignments((prev) => ({
      ...prev,
      [role]: userId
        ? { user_id: userId, name: undefined } // selecting a user clears typed name
        : { user_id: undefined, name: prev[role].name }, // keep typed name if any
    }));
  };

  const handleNameChange = (role: RotaRole, value: string) => {
    const name = value.trim();
    setAssignments((prev) => ({
      ...prev,
      [role]: name
        ? { name, user_id: undefined } // typing a name clears selected user
        : { user_id: prev[role].user_id, name: undefined },
    }));
  };

  const assignmentsPayload = useMemo(() => {
    return ROLES.map(({ key }) => {
      const a = assignments[key];
      const name = a.name?.trim();
      const user_id = a.user_id;

      // omit empty
      if (!user_id && !name) return null;

      return {
        role: key,
        user_id,
        name: user_id ? undefined : name, // if user selected, don’t send name
      };
    }).filter(Boolean) as { role: RotaRole; user_id?: number; name?: string }[];
  }, [assignments]);

  const saveRota = async () => {
    if (!serviceDate) {
      alert("Service date is required");
      return;
    }

    setSaving(true);
    try {
      await rotaApi.create({
        service_date: serviceDate,
        service_type: serviceType,
        notes: notes.trim() ? notes.trim() : undefined,
        assignments: assignmentsPayload,
      });

      alert("Rota saved successfully");
      // optional reset:
      setServiceDate("");
      setNotes("");
      setAssignments({
        opening_prayer: {},
        rhapsody_reading: {},
        closing_announcements: {},
      });
    } catch (e) {
      console.error(e);
      alert("Failed to save rota");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Create Service Rota</h1>

      <div className="bg-white p-4 rounded-xl shadow space-y-4">
        <div>
          <label className="block text-sm font-medium">Service Date</label>
          <input
            type="date"
            value={serviceDate}
            onChange={(e) => setServiceDate(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Service Type</label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType)}
            className="mt-1 w-full border rounded-lg px-3 py-2"
          >
            <option value="sunday">Sunday Service</option>
            <option value="wednesday">Wednesday Service</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2"
            rows={3}
          />
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow space-y-6">
        <h2 className="text-lg font-semibold">Assignments</h2>

        {ROLES.map((role) => (
          <div
            key={role.key}
            className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
          >
            <div className="font-medium">{role.label}</div>

            <select
              className="border rounded-lg px-3 py-2"
              value={assignments[role.key].user_id ?? ""}
              onChange={(e) => handleUserSelect(role.key, e.target.value)}
            >
              <option value="">Select user (optional)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Or type name"
              className="border rounded-lg px-3 py-2"
              value={assignments[role.key].name ?? ""}
              onChange={(e) => handleNameChange(role.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          onClick={saveRota}
          disabled={saving}
          className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Rota"}
        </button>
      </div>
    </div>
  );
}
