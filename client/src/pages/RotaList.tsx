import { useEffect, useState } from "react";
import { rotaApi } from "../services/api";

export default function RotaList() {
  const [rotas, setRotas] = useState<any[]>([]);

  useEffect(() => {
    rotaApi.getAll().then((res) => setRotas(res.data));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Service Rota</h1>

      {rotas.map((r) => (
        <div key={r.id} className="bg-white p-4 rounded shadow">
          <div className="font-semibold">
            {r.service_type.toUpperCase()} — {r.service_date}
          </div>

          <ul className="mt-2 text-sm">
            {r.assignments.map((a: any) => (
              <li key={a.id}>
                {a.role.replace("_", " ")}: {a.user_name || a.name || "—"}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
