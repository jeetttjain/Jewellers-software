import React, { useState, useEffect } from 'react';
import { api } from '../services/api/client.js';
import { AuditLogEntry } from '@jewellery-pos/shared';
import { Shield, Clock, User, FileText } from 'lucide-react';

export const AuditTrailPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.get<AuditLogEntry[]>('/audit');
      setLogs(data);
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-serif font-bold text-slate-900">
          Security & Compliance Audit Trail
        </h1>
        <p className="text-xs text-slate-500">
          Immutable log of all board rate edits, invoice creations, and price overrides
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 bg-slate-50">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Diff Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                    {new Date(log.createdAt).toLocaleString('en-IN')}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {log.actorName}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                    {log.action}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {log.entityName} ({log.entityId.slice(-6)})
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[10px] text-slate-500 max-w-xs truncate">
                    {JSON.stringify(log.stateDiff)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
