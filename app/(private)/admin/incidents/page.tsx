"use client"

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, ExternalLink, Download } from "lucide-react";

export const dynamic = "force-dynamic";

const statusColor: Record<string, string> = {
  pending: "bg-amber-50 text-amber-600 border-amber-100",
  assigned: "bg-blue-50 text-blue-600 border-blue-100",
  picked_up: "bg-violet-50 text-violet-600 border-violet-100",
  arrived: "bg-emerald-50 text-emerald-600 border-emerald-100",
  cancelled: "bg-slate-100 text-slate-400 border-slate-200",
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/analytics/dashboard?range=30d")
      .then((r) => r.json())
      .then(() => {
        // Fetch raw incidents list
        fetch("/api/emergency/status?admin=true")
          .then((r) => r.ok ? r.json() : { requests: [] })
          .then((d) => setIncidents(d.requests ?? []))
          .catch(() => setIncidents([]))
          .finally(() => setLoading(false));
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = incidents.filter((i) =>
    !search ||
    i.id?.toLowerCase().includes(search.toLowerCase()) ||
    i.emergency_type?.toLowerCase().includes(search.toLowerCase()) ||
    i.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-10 space-y-6 min-h-screen">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Incident Review</h1>
          <p className="text-slate-400 font-bold text-sm mt-1">Click any incident to view timeline, decisions, and AI feedback.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID, type, address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 h-10 w-72 rounded-2xl bg-white border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none"
          />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-slate-400 font-bold animate-pulse">Loading incidents…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-slate-400 font-bold">No incidents found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                {["ID", "Type", "Address", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((inc) => (
                <tr key={inc.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-xs font-black text-slate-500 font-mono">
                    {inc.id?.slice(0, 8)}…
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">{inc.emergency_type}</td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{inc.address}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${statusColor[inc.status] ?? "bg-slate-100 text-slate-400 border-slate-200"}`}>
                      {inc.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400 font-bold">
                    {new Date(inc.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/incidents/${inc.id}`}
                        className="flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Review
                      </Link>
                      <a
                        href={`/api/analytics/export/${inc.id}?format=json`}
                        className="flex items-center gap-1 text-xs font-black text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                        target="_blank"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Export
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
