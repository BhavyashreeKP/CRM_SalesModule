'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus } from 'lucide-react'
import { createContact, fetchContactById, updateContact, type ContactPayload, type ContactRecord } from '@/lib/contactApi'

const phonePattern = /^\+?\d{10,15}$/

export default function ContactFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const [form, setForm] = useState<ContactPayload>({
    contactName: '',
    designation: '',
    contactNumber: '',
    email: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditing || !id) return
    const loadContact = async () => {
      const contact = (await fetchContactById(id)) as ContactRecord | null
      if (contact) {
        setForm({
          contactName: contact.contactName,
          designation: contact.designation,
          contactNumber: contact.contactNumber,
          email: contact.email,
        })
      }
    }
    void loadContact()
  }, [id, isEditing])

  const handleChange = (field: keyof ContactPayload, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.contactName.trim() || !form.designation.trim() || !form.contactNumber.trim() || !form.email.trim()) {
      setSubmitError('Contact Name, Designation, Contact Number, and Email are required.')
      return
    }
    if (!phonePattern.test(form.contactNumber.replace(/\s+/g, ''))) {
      setSubmitError('Please enter a valid mobile number.')
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)
    try {
      if (isEditing && id) {
        await updateContact(id, form)
      } else {
        await createContact(form)
      }
      navigate('/sales/contacts')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save contact')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => navigate('/sales/contacts')} className="flex items-center gap-2 text-sm font-semibold text-[#2563eb]">
          <ArrowLeft className="h-4 w-4" />
          Back to Contacts List
        </button>
      </div>

      <div className="rounded-lg border border-[#EFECE5] bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-2xl font-semibold text-gray-900">{isEditing ? 'Edit Contact' : 'Add Contact'}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Contact Name *</span>
              <input value={form.contactName} onChange={(event) => handleChange('contactName', event.target.value)} placeholder="Contact Name" className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Designation *</span>
              <input value={form.designation} onChange={(event) => handleChange('designation', event.target.value)} placeholder="Designation" className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Phone Number *</span>
              <input value={form.contactNumber} onChange={(event) => handleChange('contactNumber', event.target.value)} placeholder="Phone Number" className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">Email Address *</span>
              <input type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="Email Address" className="w-full rounded-lg border border-[#EFECE5] bg-white px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#CEC9BD]" />
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-[#EFECE5] pt-4">
            <button type="button" onClick={() => navigate('/sales/contacts')} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-semibold text-slate-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60">{isSubmitting ? 'Submitting...' : 'Submit'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
