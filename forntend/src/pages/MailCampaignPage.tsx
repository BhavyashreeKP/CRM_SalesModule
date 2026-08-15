'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Search, Eye, Pencil, Trash2, Copy, Mail, FileText, Clock3, Send, CheckCircle2, AlertCircle, Layers3 } from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { getCampaigns, deleteCampaign, MailCampaignRecord } from '@/lib/mailCampaignApi'

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-700',
  Scheduled: 'bg-amber-100 text-amber-700',
  Sending: 'bg-blue-100 text-blue-700',
  Sent: 'bg-green-100 text-green-700',
  Failed: 'bg-red-100 text-red-700',
  Trash: 'bg-slate-100 text-slate-700',
}

export default function MailCampaignPage() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<MailCampaignRecord[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [recipientGroup, setRecipientGroup] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const loadCampaigns = async (nextPage = page, nextLimit = pageSize) => {
    const data = await getCampaigns({ search, status, recipientGroup, createdBy, page: nextPage, limit: nextLimit })
    setCampaigns(data.data || [])
    setTotalPages(data.pagination?.totalPages || 1)
    setTotalCount(data.pagination?.total || 0)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCampaigns(1, pageSize)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search, status, recipientGroup, createdBy, pageSize])

  useEffect(() => {
    void loadCampaigns(page, pageSize)
  }, [page])

  const stats = useMemo(() => ({
    total: campaigns.length,
    drafts: campaigns.filter((item) => item.status === 'Draft').length,
    scheduled: campaigns.filter((item) => item.status === 'Scheduled').length,
    sent: campaigns.filter((item) => item.status === 'Sent').length,
  }), [campaigns])

  const tableCellClass = 'px-3 py-3 border-r border-[#D1D5DB]'

  const handleDelete = async (id: string) => {
    if (!window.confirm('Move this campaign to trash?')) return
    await deleteCampaign(id)
    void loadCampaigns()
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-serif font-bold text-gray-900">Mail Campaign Dashboard</h1>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
            <Download className="h-4 w-4" />
            Download Report
          </button>
          <button onClick={() => navigate('/sales/mail-campaign/new')} className="flex items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white shadow-sm">
            <Plus className="h-4 w-4" />
            Campaign
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Mail} label="Total Campaigns" value={stats.total} description="All active campaigns" iconBg="bg-[#F2EFE8]" iconColor="text-[#2563EB]" />
        <StatCard icon={FileText} label="Draft Campaigns" value={stats.drafts} description="Saved for later review" iconBg="bg-[#F2EFE8]" iconColor="text-gray-700" />
        <StatCard icon={Clock3} label="Scheduled Campaigns" value={stats.scheduled} description="Queued for sending" iconBg="bg-[#F2EFE8]" iconColor="text-amber-700" />
        <StatCard icon={Send} label="Sent Campaigns" value={stats.sent} description="Completed campaigns" iconBg="bg-[#F2EFE8]" iconColor="text-green-700" />
      </div>

      <div className="rounded-xl border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="mb-6 grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Search Campaign Name</label>
            <div className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search campaign" />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Status</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none">
              <option value="">All</option>
              <option value="Draft">Draft</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Sending">Sending</option>
              <option value="Sent">Sent</option>
              <option value="Failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Recipient Group</label>
            <select value={recipientGroup} onChange={(event) => setRecipientGroup(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none">
              <option value="">All</option>
              <option value="Customers">Customers</option>
              <option value="Contacts">Contacts</option>
              <option value="Suppliers">Suppliers</option>
              <option value="Leads">Leads</option>
              <option value="Employees">Employees</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Created By</label>
            <input value={createdBy} onChange={(event) => setCreatedBy(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none" placeholder="Name" />
          </div>
        </div>

        <div className="overflow-x-auto">
          {campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#EFECE5] bg-[#FAF8F2] px-6 py-12 text-center text-sm text-gray-500">No campaigns found.</div>
          ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#EFECE5] bg-[#F2EFE8] text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                <th className={tableCellClass}>Campaign ID</th>
                <th className={tableCellClass}>Campaign Name</th>
                <th className={tableCellClass}>Subject</th>
                <th className={tableCellClass}>Recipient Group</th>
                <th className={tableCellClass}>Created By</th>
                <th className={tableCellClass}>Created Date</th>
                <th className={tableCellClass}>Scheduled Date</th>
                <th className={tableCellClass}>Status</th>
                <th className={tableCellClass}>Opens</th>
                <th className={tableCellClass}>Clicks</th>
                <th className={tableCellClass}>Action</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign._id} className="border-b border-gray-100 last:border-0">
                  <td className={`${tableCellClass} font-medium text-gray-900`}>{campaign.campaignId}</td>
                  <td className={`${tableCellClass}`}>{campaign.campaignName}</td>
                  <td className={`${tableCellClass}`}>{campaign.subject}</td>
                  <td className={`${tableCellClass}`}>{campaign.recipientGroup.join(', ')}</td>
                  <td className={`${tableCellClass}`}>{campaign.createdBy}</td>
                  <td className={`${tableCellClass}`}>{campaign.createdDate}</td>
                  <td className={`${tableCellClass}`}>{campaign.scheduledDate || '—'}</td>
                  <td className={`${tableCellClass}`}><span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusColors[campaign.status] || statusColors.Draft}`}>{campaign.status}</span></td>
                  <td className={`${tableCellClass}`}>{campaign.opens}</td>
                  <td className={`${tableCellClass}`}>{campaign.clicks}</td>
                  <td className={tableCellClass}>
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="View"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => navigate(`/sales/mail-campaign/edit/${campaign._id}`)} className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(campaign._id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
                      <button className="rounded-lg p-2 text-gray-600 hover:bg-gray-100" title="Duplicate"><Copy className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE5] pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <select className="rounded border border-[#EFECE5] bg-white px-2 py-1.5 text-sm text-gray-700" value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="text-sm text-gray-500">Showing {(totalCount === 0 ? 0 : (page - 1) * pageSize + 1)} to {Math.min(page * pageSize, totalCount)} of {totalCount} entries</div>
          <div className="flex items-center gap-2">
            <button className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
            <button className="rounded border border-[#EFECE5] bg-white p-2 text-gray-600 disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-[2]" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
