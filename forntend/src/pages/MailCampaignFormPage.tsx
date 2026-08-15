'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { createCampaign, fetchRecipientCounts, fetchRecipientData, getCampaignById, sendCampaign, updateCampaign } from '@/lib/mailCampaignApi'
import { TiptapEditor } from '@/components/TiptapEditor'

const stepLabels = ['Campaign Details', 'Recipients', 'Email Designer', 'Review & Send']
const recipientModules = ['Customers', 'Contacts', 'Suppliers', 'Leads', 'Employees']
const emptyRecipientCounts: Record<string, number> = { Customers: 0, Contacts: 0, Suppliers: 0, Leads: 0, Employees: 0 }

export default function MailCampaignFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const [step, setStep] = useState(1)
  const [campaignName, setCampaignName] = useState('')
  const [subject, setSubject] = useState('')
  const [campaignType, setCampaignType] = useState('Promotional')
  const [priority, setPriority] = useState('Medium')
  const [imageAlignment, setImageAlignment] = useState('Image Before Text')
  const [tags, setTags] = useState<string[]>([])
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [recipientEmails, setRecipientEmails] = useState<string[]>([])
  const [recipientCount, setRecipientCount] = useState(0)
  const [recipientCounts, setRecipientCounts] = useState<Record<string, number>>(emptyRecipientCounts)
  const [campaignBody, setCampaignBody] = useState('')
  const [footer, setFooter] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [status, setStatus] = useState('Draft')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [timezone, setTimezone] = useState('UTC')
  const [testEmail, setTestEmail] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    const loadCampaign = async () => {
      const campaign = await getCampaignById(id)
      setCampaignName(campaign.campaignName || '')
      setSubject(campaign.subject || '')
      setCampaignType(campaign.campaignType || 'Promotional')
      setPriority(campaign.priority || 'Medium')
      setImageAlignment(campaign.imageAlignment || 'Image Before Text')
      setTags(campaign.tags || [])
      setSelectedModules(campaign.recipientModules || [])
      setRecipientEmails(campaign.recipientEmails || [])
      setRecipientCount(campaign.recipientCount || 0)
      setCampaignBody(campaign.campaignBody || '')
      setFooter(campaign.footer || '')
      setStatus(campaign.status || 'Draft')
      setScheduledDate(campaign.scheduledDate || '')
      setScheduledTime(campaign.scheduledTime || '')
      setTimezone(campaign.timezone || 'UTC')
      setTestEmail(campaign.testEmail || '')
      if (campaign.image) setImagePreview(campaign.image)
    }
    void loadCampaign()
  }, [id])

  useEffect(() => {
    const loadRecipientCounts = async () => {
      try {
        const response = await fetchRecipientCounts()
        const nextCounts = response?.data || emptyRecipientCounts
        setRecipientCounts({ ...emptyRecipientCounts, ...nextCounts })
      } catch (error) {
        console.error('Unable to load recipient counts:', error)
      }
    }

    void loadRecipientCounts()

    const intervalId = window.setInterval(() => {
      void loadRecipientCounts()
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [])

  useEffect(() => {
    const nextCount = selectedModules.reduce((sum, module) => sum + (recipientCounts[module] || 0), 0)
    setRecipientCount(nextCount)

    const loadSelectedRecipientEmails = async () => {
      if (!selectedModules.length) {
        setRecipientEmails([])
        return
      }

      try {
        const response = await fetchRecipientData(selectedModules)
        const modulesData = response?.data || {}
        const emails = selectedModules.flatMap((module) => modulesData[module] || [])
        setRecipientEmails([...new Set(emails)])
      } catch (error) {
        console.error('Unable to load recipient emails:', error)
        setRecipientEmails([])
      }
    }

    void loadSelectedRecipientEmails()
  }, [selectedModules, recipientCounts])

  const handleModuleToggle = (module: string) => {
    setSelectedModules((current) => current.includes(module) ? current.filter((item) => item !== module) : [...current, module])
  }

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setImageFile(file)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
  }

  const handleAttachmentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setAttachments((current) => [...current, ...files])
  }

  const validateRequired = () => !!campaignName && !!subject && selectedModules.length > 0 && !!campaignBody && !!footer

  const handleAction = async (actionStatus: string) => {
    try {
      if (!validateRequired()) {
        setError('Please fill out all required fields.')
        return
      }
      setError('')

      const createdBy = typeof window !== 'undefined'
        ? (window.localStorage.getItem('userName') || window.localStorage.getItem('name') || 'Admin')
        : 'Admin'
      const nextRecipientCount = recipientEmails.length || recipientCount
      const formData = new FormData()
      formData.append('campaignName', campaignName)
      formData.append('subject', subject)
      formData.append('campaignType', campaignType)
      formData.append('priority', priority)
      formData.append('imageAlignment', imageAlignment)
      formData.append('tags', JSON.stringify(tags))
      formData.append('recipientModules', JSON.stringify(selectedModules))
      formData.append('recipientGroup', JSON.stringify(selectedModules))
      formData.append('recipientEmails', JSON.stringify(recipientEmails))
      formData.append('recipientCount', String(nextRecipientCount))
      formData.append('campaignBody', campaignBody)
      formData.append('footer', footer)
      formData.append('status', actionStatus)
      formData.append('createdBy', createdBy)
      formData.append('createdDate', new Date().toISOString().split('T')[0])
      formData.append('scheduledDate', scheduledDate)
      formData.append('scheduledTime', scheduledTime)
      formData.append('timezone', timezone)
      formData.append('testEmail', testEmail)
      if (imageFile) formData.append('image', imageFile)
      attachments.forEach((file) => formData.append('attachments', file))

      let campaignId = id || ''

      if (id) {
        await updateCampaign(id, formData)
      } else {
        const created = await createCampaign(formData)
        campaignId = created?.data?._id || created?.data?.id || ''
      }

      if (actionStatus === 'Sent' && campaignId) {
        const sendResponse = await sendCampaign(campaignId, recipientEmails)
        if (!sendResponse?.success) {
          setError(sendResponse?.message || 'Campaign was saved but sending failed.')
          navigate('/sales/mail-campaign')
          return
        }
      }

      navigate('/sales/mail-campaign')
    } catch (err) {
      console.error('Unable to save campaign:', err)
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while saving the campaign.')
    }
  }

  const reviewSummary = useMemo(() => ({
    campaignName,
    subject,
    recipientCount,
    imagePreview,
    campaignBody,
    footer,
    attachments,
  }), [campaignName, subject, recipientCount, imagePreview, campaignBody, footer, attachments])

  const handleStepNavigation = (targetStep: number) => {
    if (targetStep < 1 || targetStep > stepLabels.length) return
    setStep(targetStep)
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-3xl font-serif font-bold text-gray-900">Mail Campaign</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          {stepLabels.map((label, index) => {
            const currentStep = index + 1
            const isActive = step === currentStep
            const isCompleted = currentStep < step

            return (
              <button
                key={label}
                type="button"
                onClick={() => handleStepNavigation(currentStep)}
                className="flex cursor-pointer items-center gap-2 text-left"
              >
                {/* <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isActive ? 'bg-[#2563EB] text-white' : isCompleted ? 'bg-[#E0F2FE] text-[#2563EB]' : 'bg-[#F2EFE8] text-gray-700'}`}>
                  {index + 1}
                </div> */}
                <span className={isActive ? 'font-semibold text-gray-900' : isCompleted ? 'font-medium text-gray-700' : ''}>{label}</span>
                {index < stepLabels.length - 1 && <ChevronRight className="h-4 w-4 text-gray-400" />}
              </button>
            )
          })}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="rounded-xl border border-[#EFECE5] bg-white p-6 shadow-sm">
        {step === 1 && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Name *</label>
                <input value={campaignName} onChange={(event) => setCampaignName(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Email Subject *</label>
                <input value={subject} onChange={(event) => setSubject(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none" />
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Type</label>
                <select value={campaignType} onChange={(event) => setCampaignType(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none">
                  {['Promotional', 'Newsletter', 'Announcement', 'Reminder', 'Product Launch', 'Offer'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Priority</label>
                <select value={priority} onChange={(event) => setPriority(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none">
                  {['Low', 'Medium', 'High'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Image Alignment</label>
                <select value={imageAlignment} onChange={(event) => setImageAlignment(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none">
                  {['Image Before Text', 'Image After Text'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Tags</label>
              <input value={tags.join(', ')} onChange={(event) => setTags(event.target.value.split(',').map((item) => item.trim()).filter(Boolean))} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none" placeholder="Enter tags separated by commas" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {recipientModules.map((module) => (
                <button key={module} onClick={() => handleModuleToggle(module)} className={`rounded-lg border p-4 text-left ${selectedModules.includes(module) ? 'border-[#2563EB] bg-[#EFF6FF]' : 'border-[#EFECE5] bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{module}</span>
                    <span className="text-sm text-gray-500">{recipientCounts[module] || 0} {recipientCounts[module] === 1 ? 'recipient' : 'recipients'}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-900">Total</span>
                <span className="font-semibold text-[#2563EB]">{recipientCount} recipients</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Email Body</label>
              <TiptapEditor value={campaignBody} onChange={setCampaignBody} placeholder="Compose your campaign body" />
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Upload Campaign Image</label>
                <input type="file" accept="image/*" onChange={handleImageSelect} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm" />
                {imagePreview && (
                  <div className="mt-4 rounded-lg border border-[#EFECE5] p-4">
                    <img src={imagePreview} alt="Campaign preview" className="max-h-56 rounded-lg object-contain" />
                  </div>
                )}
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Attachments</label>
                <input type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip" onChange={handleAttachmentSelect} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm" />
                {attachments.length > 0 && <ul className="mt-3 space-y-2 text-sm text-gray-700">{attachments.map((file) => <li key={file.name} className="rounded border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2">{file.name}</li>)}</ul>}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Footer</label>
              <TiptapEditor value={footer} onChange={setFooter} placeholder="Compose your campaign footer" />
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">Campaign Review</h3>
                <dl className="space-y-2 text-sm text-gray-700">
                  <div className="flex justify-between"><dt className="font-medium">Campaign Name</dt><dd>{campaignName || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">Subject</dt><dd>{subject || '—'}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">Recipient Count</dt><dd>{recipientCount}</dd></div>
                  <div className="flex justify-between"><dt className="font-medium">Status</dt><dd>{status}</dd></div>
                </dl>
              </div>
              <div className="rounded-lg border border-[#EFECE5] bg-[#FAF8F2] p-4">
                <h3 className="mb-3 text-lg font-semibold text-gray-900">Preview</h3>
                <div className="space-y-3">
                  {imagePreview && <img src={imagePreview} alt="Campaign preview" className="max-h-32 rounded-lg object-contain" />}
                  <div className="rounded border border-[#EFECE5] bg-white p-3 text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: campaignBody }} />
                  <div className="rounded border border-[#EFECE5] bg-white p-3 text-sm text-gray-700" dangerouslySetInnerHTML={{ __html: footer }} />
                </div>
              </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Schedule Date</label>
                <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Schedule Time</label>
                <input type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Timezone</label>
                <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none">
                  {['UTC', 'IST', 'EST', 'CET'].map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-gray-500">Test Email</label>
              <input value={testEmail} onChange={(event) => setTestEmail(event.target.value)} className="w-full rounded-lg border border-[#EFECE5] bg-[#FAF8F2] px-3 py-2 text-sm outline-none" placeholder="Enter test email" />
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-end gap-3 border-t border-[#EFECE5] pt-6">
          {step < stepLabels.length && <button onClick={() => setStep(step + 1)} className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white">Continue</button>}
          {step === stepLabels.length && <>
            <button onClick={() => void handleAction('Draft')} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700">Save Draft</button>
            <button onClick={() => void handleAction('Scheduled')} className="rounded-lg border border-[#EFECE5] bg-white px-4 py-2 text-sm font-medium text-gray-700">Schedule</button>
            <button onClick={() =>  void handleAction('Sent') } className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-medium text-white">Send Now</button>
           
          </>}
        </div>
      </div>
    </div>
  )
}
