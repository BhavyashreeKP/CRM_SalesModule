import { useEffect, useMemo, useState } from 'react';
import { X, Mail, Phone, Building2, CalendarDays, Sparkles, Users, FileText, MessageCircleMore, Clock3 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { type LeadRecord } from '@/lib/leadApi';

interface LeadDetailsDrawerProps {
  lead: LeadRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  New: 'bg-blue-100 text-blue-700',
  Contacted: 'bg-sky-100 text-sky-700',
  'Follow-up': 'bg-amber-100 text-amber-700',
  Interested: 'bg-violet-100 text-violet-700',
  Qualified: 'bg-emerald-100 text-emerald-700',
  'Proposal Sent': 'bg-purple-100 text-purple-700',
  Negotiation: 'bg-orange-100 text-orange-700',
  Won: 'bg-green-100 text-green-700',
  Lost: 'bg-red-100 text-red-700',
  Scrapped: 'bg-gray-100 text-gray-700',
};

export function LeadDetailsDrawer({ lead, isOpen, onClose }: LeadDetailsDrawerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      const timeout = window.setTimeout(() => setVisible(false), 180);
      return () => window.clearTimeout(timeout);
    }
  }, [isOpen]);

  const engagementScore = useMemo(() => {
    const score = Number(lead?.leadScore || 0);
    if (score > 80) return { label: 'Hot', color: 'bg-red-100 text-red-700' };
    if (score >= 50) return { label: 'Warm', color: 'bg-amber-100 text-amber-700' };
    return { label: 'Cold', color: 'bg-gray-100 text-gray-700' };
  }, [lead]);

  if (!isOpen && !visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex justify-end bg-black/30 backdrop-blur-[1px]">
      <div className={`h-full w-full max-w-2xl transform bg-white shadow-2xl transition-transform duration-200 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-[#EFECE5] bg-[#FAF8F2] px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Lead Details</p>
            <h3 className="text-xl font-serif font-semibold text-gray-900">{lead?.companyName || 'Lead Overview'}</h3>
          </div>
          <button onClick={onClose} className="rounded p-2 text-gray-600 hover:bg-white"><X className="h-5 w-5" /></button>
        </div>
        <div className="max-h-[calc(100vh-80px)] overflow-y-auto p-6">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-5">
            <div>
              <p className="text-sm font-semibold text-gray-700">{lead?.contactPerson}</p>
              <p className="text-sm text-gray-600">{lead?.designation || 'Lead'}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusColors[lead?.leadStatus || 'New'] || 'bg-blue-100 text-blue-700'}`}>{lead?.leadStatus || 'New'}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-semibold ${engagementScore.color}`}>{engagementScore.label}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[#EFECE5] p-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Company Information</p>
              <div className="space-y-2 text-sm text-gray-700">
                <p className="flex items-center gap-2"><Building2 className="h-4 w-4 text-[#2563EB]" /> {lead?.companyName}</p>
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-[#2563EB]" /> {lead?.email}</p>
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-[#2563EB]" /> {lead?.mobile}</p>
              </div>
            </div>
            <div className="rounded-lg border border-[#EFECE5] p-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Campaign Details</p>
              <div className="space-y-2 text-sm text-gray-700">
                <p className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-[#2563EB]" /> {lead?.campaignName || 'Manual'}</p>
                <p className="flex items-center gap-2"><Users className="h-4 w-4 text-[#2563EB]" /> {lead?.assignedTo || 'Unassigned'}</p>
                <p className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#2563EB]" /> {lead?.followUpDate || 'No follow-up'} {lead?.followUpTime ? `• ${lead.followUpTime}` : ''}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-[#EFECE5] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Lead Score</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{lead?.leadScore || 0}</p>
            </div>
            <div className="rounded-lg border border-[#EFECE5] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Priority</p>
              <p className="mt-2 text-lg font-semibold text-gray-900">{lead?.priority || 'Low'}</p>
            </div>
            <div className="rounded-lg border border-[#EFECE5] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Open Count</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{lead?.emailOpenCount || lead?.openCount || 0}</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-lg border border-[#EFECE5] p-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Timeline</p>
              <div className="space-y-3">
                {(lead?.timeline || []).slice().reverse().map((item, index) => (
                  <div key={`${item.title}-${index}`} className="border-l-2 border-[#DAD5C9] pl-4">
                    <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">{item.description}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Recently added'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-[#EFECE5] p-4">
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Notes & Activities</p>
              <div className="space-y-3">
                {(lead?.notes || []).length > 0 ? lead.notes.map((note, index) => (
                  <div key={`${note.message}-${index}`} className="rounded-lg bg-[#FAF8F2] p-3 text-sm text-gray-700">
                    <p>{note.message}</p>
                    <p className="mt-2 text-xs text-gray-500">{note.createdBy} • {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Just now'}</p>
                  </div>
                )) : <p className="text-sm text-gray-600">No notes have been added yet.</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-lg border border-[#EFECE5] p-4">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">Mail Engagement</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
              {[
                ['Email Opens', lead?.emailOpenCount || lead?.openCount || 0],
                ['Link Clicks', lead?.linkClicks || 0],
                ['Downloads', lead?.downloads || 0],
                ['Replies', lead?.replies || 0],
                ['Website Visits', lead?.websiteVisits || 0],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-[#FAF8F2] p-3 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
                  <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
