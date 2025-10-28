import { Client, Meeting } from '@/types/database'

export const exportToJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `${filename}.json`)
}

export const exportToCSV = (data: Client[], filename: string) => {
  const headers = ['Name', 'Phone', 'Project Description', 'Budget', 'Status', 'Created']
  const rows = data.map((client) => [
    client.name,
    client.phone || '',
    client.project_description || '',
    client.budget ? client.budget.toString() : '',
    client.status,
    new Date(client.created_at).toLocaleDateString(),
  ])

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv' })
  downloadBlob(blob, `${filename}.csv`)
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'uncertain':
      return 'bg-gray-100 text-gray-800'
    case 'potential':
      return 'bg-yellow-100 text-yellow-800'
    case 'ongoing':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getClientStatusColor = (status: string): string => {
  switch (status) {
    case 'uncertain':
      return 'bg-gray-100 text-gray-800'
    case 'potential':
      return 'bg-yellow-100 text-yellow-800'
    case 'ongoing':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getClientStatusLabel = (status: string): string => {
  switch (status) {
    case 'uncertain':
      return 'Uncertain'
    case 'potential':
      return 'Potential'
    case 'ongoing':
      return 'Ongoing'
    case 'completed':
      return 'Completed'
    default:
      if (!status) return 'Unknown'
      return status.charAt(0).toUpperCase() + status.slice(1)
  }
}

export const getStatusLabel = (status: string): string => {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export const formatCurrency = (amount: number | null, currency: string = 'USD'): string => {
  if (!amount) return `${getCurrencySymbol(currency)}0`
  return new Intl.NumberFormat(getLocaleForCurrency(currency), {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const getCurrencySymbol = (currency: string): string => {
  const symbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    INR: '₹',
    AUD: 'A$',
    CAD: 'C$',
    JPY: '¥',
    CNY: '¥',
  }
  return symbols[currency] || currency
}

const getLocaleForCurrency = (currency: string): string => {
  const locales: Record<string, string> = {
    USD: 'en-US',
    EUR: 'de-DE',
    GBP: 'en-GB',
    INR: 'en-IN',
    AUD: 'en-AU',
    CAD: 'en-CA',
    JPY: 'ja-JP',
    CNY: 'zh-CN',
  }
  return locales[currency] || 'en-US'
}
