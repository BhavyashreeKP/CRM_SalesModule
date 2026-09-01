'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Search, Mail, FileText, Clock3, Send, Trash2 } from 'lucide-react'
import { StatCard } from '@/components/stat-card'
import { deleteCampaign, getCampaigns, MailCampaignRecord } from '@/lib/mailCampaignApi'

export default function MailCampaignPage() {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<MailCampaignRecord[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadCampaigns = async (nextPage = page, nextLimit = pageSize) => {
    const data = await getCampaigns({ search, page: nextPage, limit: nextLimit })
    setCampaigns(data.data || [])
    setTotalPages(data.pagination?.totalPages || 1)
    setTotalCount(data.pagination?.total || 0)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCampaigns(1, pageSize)
    }, 200)
    return () => window.clearTimeout(timer)
  }, [search, pageSize])

  useEffect(() => {
    void loadCampaigns(page, pageSize)
  }, [page])

  const stats = useMemo(() => ({
    total: campaigns.length,
    drafts: campaigns.filter((item) => item.status === 'Draft').length,
    scheduled: campaigns.filter((item) => item.status === 'Scheduled').length,
    sent: campaigns.filter((item) => item.status === 'Sent').length,
  }), [campaigns])

  const tableCellClass = 'border border-[#E5E7EB] px-3 py-2.5 align-middle'
  const formatDate = (value?: string) => {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  const handleDelete = async (campaign: MailCampaignRecord) => {
    if (!window.confirm('Are you sure you want to delete this campaign?')) return
    setDeletingCampaignId(campaign.campaignId)
    setMessage('')
    setError('')
    try {
      await deleteCampaign(campaign.campaignId)
      setCampaigns((current) => current.filter((item) => item.campaignId !== campaign.campaignId))
      setTotalCount((current) => Math.max(current - 1, 0))
      setMessage('Campaign deleted successfully.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete campaign.')
    } finally {
      setDeletingCampaignId(null)
    }
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
        <div className="mb-6">
          <div className="max-w-xl">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Search Campaign</label>
            <div className="flex items-center gap-2 rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search campaign" />
            </div>
          </div>
        </div>
        {message ? <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div> : null}
        {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="overflow-x-auto">
          {campaigns.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#EFECE5] bg-[#FAF8F2] px-6 py-12 text-center text-sm text-gray-500">No campaigns found.</div>
          ) : (
          <table className="w-full min-w-[900px] border-separate border-spacing-0 overflow-hidden rounded-lg border border-[#E5E7EB] text-sm">
            <thead>
              <tr className="bg-[#F2EFE8] text-left text-xs font-semibold uppercase tracking-wider text-gray-700">
                <th className={`${tableCellClass} w-[7%] text-center`}>Sl No.</th>
                <th className={`${tableCellClass} w-[12%]`}>Campaign ID</th>
                <th className={`${tableCellClass} w-[20%]`}>Campaign Name</th>
                <th className={`${tableCellClass} w-[25%]`}>Date</th>
                <th className={`${tableCellClass} w-[9%] text-center`}>View Template</th>
                <th className={`${tableCellClass} w-[9%] text-center`}>View Report</th>
                <th className={`${tableCellClass} w-[7%] text-center`}>Opens (Total)</th>
                <th className={`${tableCellClass} w-[6%] text-center`}>Clicks (Total)</th>
                <th className={`${tableCellClass} w-[8%] text-center`}>Delete</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign, index) => (
                <tr key={campaign._id} className="hover:bg-[#FAF8F2]">
                  <td className={`${tableCellClass} text-center font-medium text-gray-900`}>{(page - 1) * pageSize + index + 1}</td>
                  <td className={`${tableCellClass} font-medium text-gray-900`}>{campaign.campaignId}</td>
                  <td className={tableCellClass}>{campaign.campaignName}</td>
                  <td className={`${tableCellClass} whitespace-nowrap`}>{formatDate(campaign.createdDate || campaign.createdAt)}</td>
                  <td className={`${tableCellClass} text-center`}>
                    <button type="button" onClick={() => navigate(`/sales/mail-campaign/view/${campaign._id}`)} className="rounded bg-[#2563EB] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8]">View</button>
                  </td>
                  <td className={`${tableCellClass} text-center`}>
                    <button type="button" onClick={() => navigate(`/sales/reports/mail-campaigns/${campaign._id}`)} className="rounded bg-[#2563EB] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1D4ED8]">Report</button>
                  </td>
                  <td className={`${tableCellClass} text-center`}>{campaign.opens}</td>
                  <td className={`${tableCellClass} text-center`}>{campaign.clicks}</td>
                  <td className={`${tableCellClass} text-center`}>
                    <button type="button" onClick={() => void handleDelete(campaign)} disabled={deletingCampaignId === campaign.campaignId} className="inline-flex items-center gap-1 rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60" aria-label={`Delete ${campaign.campaignName}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                      {deletingCampaignId === campaign.campaignId ? 'Deleting...' : 'Delete'}
                    </button>
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
