'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { X, Upload, Loader2, Camera, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import type { Client, Tag } from '@/types/database'

// ─── Schema ──────────────────────────────────────────────────────────────────

const schema = z.object({
  full_name:          z.string().min(1, 'Full name is required'),
  preferred_name:     z.string().optional().or(z.literal('')),
  email:              z.string().email('Invalid email').optional().or(z.literal('')),
  phone:              z.string().optional().or(z.literal('')),
  age:                z.string().optional().or(z.literal('')),
  date_of_birth:      z.string().optional().or(z.literal('')),
  occupation:         z.string().optional().or(z.literal('')),
  company:            z.string().optional().or(z.literal('')),
  address:            z.string().optional().or(z.literal('')),
  marital_status:     z.string().optional().or(z.literal('')),
  number_of_children: z.string().optional().or(z.literal('')),
  client_type:        z.string().optional().or(z.literal('')),
  source:             z.string().optional().or(z.literal('')),
  status:             z.string().min(1, 'Status is required'),
  notes:              z.string().optional().or(z.literal('')),
  profile_photo_url:  z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

const EMPTY_VALUES: FormValues = {
  full_name: '', preferred_name: '', email: '', phone: '',
  age: '', date_of_birth: '', occupation: '', company: '', address: '',
  marital_status: '', number_of_children: '', client_type: '', source: '',
  status: 'prospect', notes: '', profile_photo_url: '',
}

// ─── Profile photo sub-component ─────────────────────────────────────────────

function PhotoUpload({
  currentUrl, name, onUpload, userId,
}: { currentUrl?: string; name?: string; onUpload: (url: string) => void; userId?: string }) {
  const [preview, setPreview] = useState<string | undefined>(currentUrl)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setPreview(currentUrl) }, [currentUrl])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      onUpload(URL.createObjectURL(file))
      return
    }

    setUploading(true)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${userId ?? 'anon'}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('avatars').getPublicUrl(path)
        onUpload(data.publicUrl)
      }
    } finally {
      setUploading(false)
    }
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-5 pb-5 border-b border-slate-100">
      <div
        onClick={() => inputRef.current?.click()}
        className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center rounded-2xl bg-slate-100 overflow-hidden ring-2 ring-slate-200 hover:ring-indigo-400 transition-all group"
      >
        {preview ? (
          <img src={preview} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          <span className="text-xl font-semibold text-slate-400 select-none">
            {name ? getInitials(name) : <User className="h-7 w-7" />}
          </span>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
          {uploading
            ? <Loader2 className="h-5 w-5 text-white animate-spin" />
            : <Camera className="h-5 w-5 text-white" />}
        </div>
      </div>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? 'Uploading…' : 'Upload photo'}
        </button>
        <p className="mt-1 text-[10px] text-slate-400">JPG, PNG, WebP · Max 5 MB</p>
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  )
}

// ─── Select helpers ───────────────────────────────────────────────────────────

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition'
const selectCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition appearance-none'

// ─── Main drawer ─────────────────────────────────────────────────────────────

interface ClientFormDrawerProps {
  open: boolean
  mode: 'add' | 'edit'
  client?: Client | null
  allTags: Tag[]
  userId?: string
  onSuccess: (refresh?: boolean) => void
  onClose: () => void
}

export default function ClientFormDrawer({
  open, mode, client, allTags, userId, onSuccess, onClose,
}: ClientFormDrawerProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [tagsOpen, setTagsOpen] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY_VALUES,
  })

  const photoUrl = watch('profile_photo_url')
  const fullName = watch('full_name')

  // Reset form when drawer opens/mode changes
  // Depend only on client?.id so switching between clients resets correctly
  // without re-triggering on every parent render
  useEffect(() => {
    if (!open) return
    setSubmitError(null)
    setTagsOpen(false)

    if (mode === 'edit' && client) {
      reset({
        full_name:          client.full_name ?? '',
        preferred_name:     client.preferred_name ?? '',
        email:              client.email ?? '',
        phone:              client.phone ?? '',
        age:                client.age != null ? String(client.age) : '',
        date_of_birth:      client.date_of_birth ?? '',
        occupation:         client.occupation ?? '',
        company:            client.company ?? '',
        address:            client.address ?? '',
        marital_status:     client.marital_status ?? '',
        number_of_children: client.number_of_children != null ? String(client.number_of_children) : '',
        client_type:        client.client_type ?? '',
        source:             client.source ?? '',
        status:             client.status ?? 'prospect',
        notes:              client.notes ?? '',
        profile_photo_url:  client.profile_photo_url ?? '',
      })
      setSelectedTagIds([]) // tags loaded separately if needed
    } else {
      reset(EMPTY_VALUES)
      setSelectedTagIds([])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, client?.id])

  function toggleTag(id: string) {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    const supabase = createClient()

    const payload = {
      full_name:          values.full_name,
      preferred_name:     values.preferred_name || null,
      email:              values.email || null,
      phone:              values.phone || null,
      age:                values.age ? parseInt(values.age) : null,
      date_of_birth:      values.date_of_birth || null,
      occupation:         values.occupation || null,
      company:            values.company || null,
      address:            values.address || null,
      marital_status:     (values.marital_status || null) as Client['marital_status'],
      number_of_children: values.number_of_children ? parseInt(values.number_of_children) : 0,
      client_type:        (values.client_type || null) as Client['client_type'],
      source:             (values.source || null) as Client['source'],
      status:             values.status as Client['status'],
      notes:              values.notes || null,
      profile_photo_url:  values.profile_photo_url || null,
      user_id:            userId!,
    }

    try {
      let clientId: string

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      if (mode === 'add') {
        const { data, error } = await db.from('clients').insert(payload).select('id').single()
        if (error) throw error
        clientId = (data as { id: string }).id
      } else {
        const { error } = await db.from('clients').update(payload).eq('id', client!.id)
        if (error) throw error
        clientId = client!.id
      }

      // Sync tags: delete existing, insert selected
      if (selectedTagIds.length > 0 || mode === 'edit') {
        await db.from('client_tags').delete().eq('client_id', clientId)
        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map((tid: string) => ({ client_id: clientId, tag_id: tid, user_id: userId! }))
          await db.from('client_tags').insert(tagRows)
        }
      }

      onSuccess(true)
    } catch (err: any) {
      const msg = err?.message ?? err?.error_description ?? err?.msg
        ?? (typeof err === 'string' ? err : null)
        ?? JSON.stringify(err)
      console.error('[ClientFormDrawer] save error:', msg, err)
      setSubmitError(msg || 'Something went wrong. Please try again.')
    }
  }

  const selectedTagNames = allTags
    .filter(t => selectedTagIds.includes(t.id))
    .map(t => t.name)
    .join(', ')

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        className={cn(
          'fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {mode === 'add' ? 'Add New Client' : 'Edit Client'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {mode === 'add' ? 'Fill in the client details below' : 'Update client information'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-hidden"
          noValidate
        >
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

            {/* Submit error — shown at top so it's always visible */}
            {submitError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                <span className="shrink-0 font-bold">Error:</span>
                <span>{submitError}</span>
              </div>
            )}

            {/* Photo */}
            <PhotoUpload
              currentUrl={photoUrl || undefined}
              name={fullName || undefined}
              userId={userId}
              onUpload={url => setValue('profile_photo_url', url, { shouldDirty: true })}
            />

            {/* ── Identity ────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Full Name" required error={errors.full_name?.message}>
                    <input className={inputCls} placeholder="e.g. John Smith" {...register('full_name')} />
                  </Field>
                </div>
                <Field label="Preferred Name" error={errors.preferred_name?.message}>
                  <input className={inputCls} placeholder="e.g. John" {...register('preferred_name')} />
                </Field>
                <Field label="Status" required error={errors.status?.message}>
                  <select className={selectCls} {...register('status')}>
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="vip">VIP</option>
                    <option value="inactive">Inactive</option>
                    <option value="lost">Lost</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Email" error={errors.email?.message}>
                  <input className={inputCls} type="email" placeholder="john@example.com" {...register('email')} />
                </Field>
                <Field label="Phone" error={errors.phone?.message}>
                  <input className={inputCls} type="tel" placeholder="+1 555 123 4567" {...register('phone')} />
                </Field>
              </div>
            </section>

            {/* ── Personal ────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Personal Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Age" error={errors.age?.message}>
                  <input className={inputCls} type="number" min="0" max="150" placeholder="35" {...register('age')} />
                </Field>
                <Field label="Date of Birth" error={errors.date_of_birth?.message}>
                  <input className={inputCls} type="date" {...register('date_of_birth')} />
                </Field>
                <Field label="Marital Status" error={errors.marital_status?.message}>
                  <select className={selectCls} {...register('marital_status')}>
                    <option value="">— Select —</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                    <option value="separated">Separated</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="No. of Children" error={errors.number_of_children?.message}>
                  <input className={inputCls} type="number" min="0" placeholder="0" {...register('number_of_children')} />
                </Field>
              </div>
            </section>

            {/* ── Professional ────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Professional</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Occupation" error={errors.occupation?.message}>
                  <input className={inputCls} placeholder="e.g. Engineer" {...register('occupation')} />
                </Field>
                <Field label="Company" error={errors.company?.message}>
                  <input className={inputCls} placeholder="e.g. Acme Inc." {...register('company')} />
                </Field>
              </div>
              <Field label="Address" error={errors.address?.message}>
                <input className={inputCls} placeholder="123 Main St, City, Country" {...register('address')} />
              </Field>
            </section>

            {/* ── CRM Classification ──────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">CRM Classification</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Client Type" error={errors.client_type?.message}>
                  <select className={selectCls} {...register('client_type')}>
                    <option value="">— Select —</option>
                    <option value="prospect">Prospect</option>
                    <option value="active">Active</option>
                    <option value="vip">VIP</option>
                    <option value="referral">Referral</option>
                    <option value="inactive">Inactive</option>
                    <option value="former">Former</option>
                  </select>
                </Field>
                <Field label="Source" error={errors.source?.message}>
                  <select className={selectCls} {...register('source')}>
                    <option value="">— Select —</option>
                    <option value="referral">Referral</option>
                    <option value="warm">Warm</option>
                    <option value="cold_call">Cold Call</option>
                    <option value="social_media">Social Media</option>
                    <option value="event">Event</option>
                    <option value="website">Website</option>
                    <option value="existing_client">Existing Client</option>
                    <option value="walk_in">Walk-in</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
              </div>

              {/* Tags */}
              <Field label="Tags">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTagsOpen(o => !o)}
                    className={cn(inputCls, 'flex items-center justify-between text-left')}
                  >
                    <span className={selectedTagNames ? 'text-slate-900' : 'text-slate-400'}>
                      {selectedTagNames || 'Select tags…'}
                    </span>
                    <span className="text-slate-400 text-xs">▾</span>
                  </button>
                  {tagsOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                      {allTags.length === 0 ? (
                        <p className="px-4 py-3 text-xs text-slate-400">No tags yet. Create tags in Settings.</p>
                      ) : (
                        allTags.map(tag => (
                          <label key={tag.id} className="flex cursor-pointer items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedTagIds.includes(tag.id)}
                              onChange={() => toggleTag(tag.id)}
                              className="h-3.5 w-3.5 rounded accent-indigo-600"
                            />
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="text-sm text-slate-700">{tag.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </Field>
            </section>

            {/* ── Notes ───────────────────────────────────── */}
            <section className="space-y-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">Notes</h3>
              <Field label="Internal Notes" error={errors.notes?.message}>
                <textarea
                  className={cn(inputCls, 'min-h-[100px] resize-y')}
                  placeholder="Private notes about this client…"
                  {...register('notes')}
                />
              </Field>
            </section>

            {submitError && (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
                {submitError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-2 bg-slate-50/80">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-70 transition-colors shadow-sm"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {mode === 'add' ? 'Create Client' : 'Save Changes'}
            </button>
          </div>
        </form>
      </aside>
    </>
  )
}
