import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  description?: string
  iconColor?: string
}

export function StatCard({
  icon: Icon,
  label,
  value,
  description,
  iconColor = 'text-gray-600',
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {label}
          </div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
          {description && (
            <p className="text-xs text-gray-600 mt-1">{description}</p>
          )}
        </div>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
    </div>
  )
}
