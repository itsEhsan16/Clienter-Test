import { Client, Meeting } from '@/types/database'

export const exportToJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  downloadBlob(blob, `${filename}.json`)
}

export const exportToCSV = (data: any[], filename: string) => {
  let headers: string[] = []
  let rows: any[][] = []

  if (!data || data.length === 0) {
    headers = []
    rows = []
  } else if (typeof data[0] === 'object' && !Array.isArray(data[0])) {
    // Generic object array - infer headers from keys
    headers = Object.keys(data[0])
    rows = data.map((row) => headers.map((h) => row[h] ?? ''))
  } else {
    // Fallback: not objects - stringify values
    headers = ['Value']
    rows = data.map((d) => [String(d)])
  }

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
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
    case 'new':
      return 'bg-purple-100 text-purple-800'
    case 'ongoing':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getClientStatusColor = (status?: string): string => {
  switch (status) {
    case 'new':
      return 'bg-purple-100 text-purple-800'
    case 'ongoing':
      return 'bg-green-100 text-green-800'
    case 'completed':
      return 'bg-blue-100 text-blue-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

export const getClientStatusLabel = (status?: string): string => {
  switch (status) {
    case 'new':
      return 'New'
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

export const formatCurrency = (amount: number | null, _currency?: string): string => {
  // Application-wide currency: Indian Rupee (₹)
  const currency = 'INR'
  if (amount === null || amount === undefined) return `₹0`
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    currencyDisplay: 'symbol',
  }).format(amount)
}

// Deprecated: we keep symbol map for reference, but the app always uses INR
const getCurrencySymbol = (_currency: string): string => {
  return '₹'
}

const getLocaleForCurrency = (_currency: string): string => {
  return 'en-IN'
}
