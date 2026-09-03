'use client'

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Plus, Pencil, Trash2, MessageCircle } from 'lucide-react'
import { Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Button, Tooltip } from '@mui/material'
import { deleteContact, fetchContacts, type ContactRecord } from '@/lib/contactApi'

const PAGE_SIZE = 20
const tableCellClass = 'px-6 py-3 border-r border-[#D1D5DB]'

export default function ContactsPage() {
  const navigate = useNavigate()
  const [allContacts, setAllContacts] = useState<ContactRecord[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)
  const [isLoading, setIsLoading] = useState(false)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const loadContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetchContacts({ page: 1, limit: 1000 })
      setAllContacts(response.data || [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadContacts()
  }, [loadContacts])

  const filteredContacts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    if (!normalizedQuery) return allContacts
    return allContacts.filter((contact) => [
      contact.contactName,
      contact.designation,
      contact.contactNumber,
      contact.email,
    ].some((value) => String(value ?? '').toLowerCase().startsWith(normalizedQuery)))
  }, [allContacts, searchQuery])

  const totalCount = filteredContacts.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const contacts = useMemo(() => {
    const startIndex = (page - 1) * pageSize
    return filteredContacts.slice(startIndex, startIndex + pageSize)
  }, [filteredContacts, page, pageSize])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const summaryText = useMemo(() => {
    if (totalCount === 0) return 'Showing 0 to 0 of 0 entries'
    return `Showing ${(page - 1) * pageSize + 1} to ${Math.min(page * pageSize, totalCount)} of ${totalCount} entries`
  }, [page, pageSize, totalCount])

  const handleDelete = useCallback(async (id: string) => {
    if (!id) return

    try {
      await deleteContact(id)
      await loadContacts()
      setFeedbackMessage('Contact deleted successfully.')
    } catch (error) {
      console.error(error)
      const backendMessage = error instanceof Error ? error.message : 'Failed to delete contact.'
      setFeedbackMessage(backendMessage)
    } finally {
      setDeleteTargetId(null)
    }
  }, [loadContacts])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 text-4xl font-serif font-bold text-[#1E293B]">Contacts</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => navigate('/sales/contacts/new')} className="flex items-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1d4ed8]">
            <Plus className="h-4 w-4" />
            ADD NEW
          </button>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setPage(1)
              }}
              placeholder="Search contacts"
              className="w-full rounded-lg border border-[#EFECE5] bg-white py-2.5 pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]"
            />
          </div>
        </div>
      </div>

      {feedbackMessage ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {feedbackMessage}
        </div>
      ) : null}

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <div className="overflow-hidden rounded-lg border border-[#EFECE5]">
          {isLoading ? (
            <div className="space-y-2 py-8">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-md bg-[#F2EFE8]" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-full text-sm">
                <thead className="bg-[#F7F5EF] text-left text-[12px] uppercase tracking-[0.4px] text-[#374151]">
                  <tr className="border-b border-[#E5E7EB]">
                    <th className={tableCellClass + ' font-bold'}>SL. NO</th>
                    <th className={tableCellClass + ' font-bold'}>CONTACT NAME</th>
                    <th className={tableCellClass + ' font-bold'}>DESIGNATION</th>
                    <th className={tableCellClass + ' font-bold'}>PHONE NUMBER</th>
                    <th className={tableCellClass + ' font-bold'}>EMAIL</th>
                    <th className={tableCellClass + ' text-center font-bold'}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.length > 0 ? (
                    contacts.map((contact, index) => {
                      const serialNumber = (page - 1) * pageSize + index + 1
                      return (
                        <ContactTableRow
                          key={`${contact._id || 'contact'}-${index}`}
                          serialNumber={serialNumber}
                          contact={contact}
                          onEdit={(id) => navigate(`/sales/contacts/edit/${id}`)}
                          onDelete={setDeleteTargetId}
                        />
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-500 border-r border-[#D1D5DB]">No contacts found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EFECE5] pt-4">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Show</span>
            <select className="rounded border border-[#EFECE5] bg-white px-2 py-1.5 text-sm text-gray-700" value={pageSize} onChange={(event) => {
              setPageSize(Number(event.target.value))
              setPage(1)
            }}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
          <div className="text-sm text-gray-500">{summaryText}</div>
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

      <Dialog open={Boolean(deleteTargetId)} onClose={() => setDeleteTargetId(null)}>
        <DialogTitle>Delete contact</DialogTitle>
        <DialogContent>
          <DialogContentText>Are you sure you want to delete this contact?</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTargetId(null)}>Cancel</Button>
          <Button color="error" onClick={() => deleteTargetId && void handleDelete(deleteTargetId)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

const ContactTableRow = memo(function ContactTableRow({
  serialNumber,
  contact,
  onEdit,
  onDelete,
}: {
  serialNumber: number
  contact: ContactRecord
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}) {
  const normalizeDigits = (value = '') => String(value).replace(/\D/g, '')
  const digits = normalizeDigits(contact.contactNumber || '')
  const hasValidPhone = digits.length >= 10
  const openWhatsApp = () => {
    if (!hasValidPhone) return
    const waNumber = digits.length === 10 ? `91${digits}` : digits
    window.open(`https://wa.me/${waNumber}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <tr className="border-b border-[#E5E7EB] bg-white transition-colors hover:bg-[#F9FAFB]">
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{serialNumber}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{contact.contactName}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{contact.designation}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>
        <span className="inline-flex items-center">
          <span>{contact.contactNumber}</span>
          <Tooltip title={hasValidPhone ? 'Open WhatsApp' : 'Phone number not available.'} arrow>
            <span>
              <button
                type="button"
                onClick={openWhatsApp}
                disabled={!hasValidPhone}
                className="inline-flex items-center ml-2 rounded p-1 text-[#25D366] hover:bg-[#F2EFE8] disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label={hasValidPhone ? 'Open WhatsApp' : 'Phone number not available.'}
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </span>
          </Tooltip>
        </span>
      </td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-sm text-gray-700`}>{contact.email}</td>
      <td className={`${tableCellClass.replace('py-3','py-4')} text-center`}>
        <div className="inline-flex items-center gap-3">
          <button type="button" onClick={() => onEdit(contact._id)} className="rounded border border-[#E5E7EB] bg-white p-2 text-gray-600 transition hover:bg-[#F3F4F6]" title="Edit">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => onDelete(contact._id)} className="rounded border border-[#E5E7EB] bg-white p-2 text-gray-600 transition hover:bg-[#F3F4F6]" title="Delete">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
})
