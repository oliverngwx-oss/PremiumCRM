import { ArrowLeft, Mail, Phone, MapPin, Briefcase, Calendar, Users, Pencil, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { cn, formatDate, getInitials } from '@/lib/utils'
import StatusBadge from './StatusBadge'
import type { Client, Tag } from '@/types/database'

interface ClientDetailProps {
  client: Client & { tags?: Tag[] }
  onEdit?: () => void
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === '') return null
  return (
    <div className="grid grid-cols-3 gap-4 py-2.5 border-b border-slate-50 last:border-0">
      <dt className="text-xs font-medium text-slate-500 flex items-center">{label}</dt>
      <dd className="col-span-2 text-sm text-slate-800">{String(value)}</dd>
    </div>
  )
}

const SOURCE_LABELS: Record<string, string> = {
  referral: 'Referral', cold_call: 'Cold Call', social_media: 'Social Media',
  event: 'Event', website: 'Website', existing_client: 'Existing Client',
  walk_in: 'Walk-in', other: 'Other',
}

const MARITAL_LABELS: Record<string, string> = {
  single: 'Single', married: 'Married', divorced: 'Divorced',
  widowed: 'Widowed', separated: 'Separated', other: 'Other',
}

export default function ClientDetail({ client, onEdit }: ClientDetailProps) {
  const displayName = client.preferred_name
    ? `${client.preferred_name} (${client.full_name})`
    : client.full_name

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header bar */}
      <div className="sticky top-0 z-10 flex items-center gap-4 border-b border-slate-200/80 bg-white/80 backdrop-blur-sm px-6 py-3">
        <Link
          href="/clients"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Clients
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-sm font-medium text-slate-700 truncate">{client.full_name}</span>
        <div className="ml-auto flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8 space-y-6">
        {/* Profile card */}
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
          {/* Cover gradient */}
          <div className="h-24 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600" />

          <div className="px-6 pb-6">
            {/* Avatar */}
            <div className="-mt-12 mb-4 flex items-end justify-between">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-md ring-4 ring-white overflow-hidden">
                {client.profile_photo_url ? (
                  <img src={client.profile_photo_url} alt={client.full_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-slate-600">{getInitials(client.full_name)}</span>
                )}
              </div>
              <StatusBadge value={client.status} />
            </div>

            <h1 className="text-xl font-bold text-slate-900">{displayName}</h1>

            {/* Quick contact bar */}
            <div className="mt-3 flex flex-wrap gap-3">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                  <Mail className="h-3.5 w-3.5" />
                  {client.email}
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                  <Phone className="h-3.5 w-3.5" />
                  {client.phone}
                </a>
              )}
              {client.address && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3.5 w-3.5" />
                  {client.address}
                </span>
              )}
              {(client.occupation || client.company) && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Briefcase className="h-3.5 w-3.5" />
                  {[client.occupation, client.company].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            {/* Tags */}
            {client.tags && client.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {client.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                    style={{ borderColor: tag.color + '40', backgroundColor: tag.color + '15', color: tag.color }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal */}
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Personal Details</h2>
            <dl>
              <DetailRow label="Age" value={client.age} />
              <DetailRow label="Date of Birth" value={client.date_of_birth ? formatDate(client.date_of_birth) : null} />
              <DetailRow label="Marital Status" value={client.marital_status ? MARITAL_LABELS[client.marital_status] ?? client.marital_status : null} />
              <DetailRow label="Children" value={client.number_of_children ?? 0} />
            </dl>
            {!client.age && !client.date_of_birth && !client.marital_status && (
              <p className="text-xs text-slate-400 py-2">No personal details recorded.</p>
            )}
          </div>

          {/* CRM */}
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">CRM Info</h2>
            <dl>
              <DetailRow label="Status" value={client.status ? client.status.charAt(0).toUpperCase() + client.status.slice(1) : null} />
              <DetailRow label="Client Type" value={client.client_type ? client.client_type.charAt(0).toUpperCase() + client.client_type.slice(1) : null} />
              <DetailRow label="Source" value={client.source ? SOURCE_LABELS[client.source] ?? client.source : null} />
              <DetailRow label="Created" value={formatDate(client.created_at)} />
              <DetailRow label="Last Updated" value={formatDate(client.updated_at)} />
            </dl>
          </div>
        </div>

        {/* Notes */}
        {client.notes && (
          <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Notes</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{client.notes}</p>
          </div>
        )}

        {/* Placeholder sections for upcoming modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Opportunities', href: '/pipeline', icon: '💼' },
            { label: 'Activities', href: '/activities', icon: '📋' },
            { label: 'Files', href: '/files', icon: '📁' },
          ].map(s => (
            <Link
              key={s.label}
              href={s.href}
              className="flex items-center gap-3 rounded-xl bg-white border border-slate-200/80 p-4 text-sm font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
            >
              <span className="text-lg">{s.icon}</span>
              <span>{s.label}</span>
              <ExternalLink className="ml-auto h-3.5 w-3.5 text-slate-400" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
