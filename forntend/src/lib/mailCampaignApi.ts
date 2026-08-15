import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api/mail-campaigns` : 'http://localhost:5001/api/mail-campaigns',
})

const getErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || error.response?.data?.details || error.message || fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}

export interface MailCampaignRecord {
  _id: string
  campaignId: string
  campaignName: string
  subject: string
  campaignType: string
  priority: string
  imageAlignment: string
  tags: string[]
  recipientModules: string[]
  recipientGroup: string[]
  recipientEmails: string[]
  recipientCount: number
  campaignBody: string
  footer: string
  image: string
  attachments: string[]
  status: string
  opens: number
  clicks: number
  createdBy: string
  createdDate: string
  scheduledDate: string
  scheduledTime: string
  timezone: string
  sentDate: string
  testEmail: string
  createdAt?: string
  updatedAt?: string
}

export interface MailCampaignListResponse {
  success: boolean
  data: MailCampaignRecord[]
  pagination: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export const getCampaigns = async (params?: Record<string, string | number>) => {
  const { data } = await api.get('/', { params })
  return data as MailCampaignListResponse
}

export const getCampaignById = async (id: string) => {
  const { data } = await api.get(`/${id}`)
  return data.data as MailCampaignRecord
}

export const createCampaign = async (formData: FormData) => {
  try {
    const { data } = await api.post('/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to create campaign.'))
  }
}

export const updateCampaign = async (id: string, formData: FormData) => {
  try {
    const { data } = await api.put(`/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to update campaign.'))
  }
}

export const deleteCampaign = async (id: string) => {
  try {
    const { data } = await api.delete(`/${id}`)
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to delete campaign.'))
  }
}

export const fetchRecipientCounts = async () => {
  const { data } = await api.get('/recipient-counts')
  return data
}

export const fetchRecipientData = async (modules?: string[]) => {
  const { data } = await api.get('/recipient-data', {
    params: { modules: modules?.join(',') || '' },
  })
  return data
}

export const sendCampaign = async (id: string, recipients?: string[]) => {
  try {
    const { data } = await api.post(`/${id}/send`, { recipients: recipients || [] })
    return data
  } catch (error) {
    throw new Error(getErrorMessage(error, 'Unable to send campaign.'))
  }
}
