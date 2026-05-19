'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod/v4'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Opportunity } from '@/types/database'

const schema = z.object({
  title:               z.string().min(1, 'Title is required'),
  product_type:        z.string().optional().or(z.literal('')),
  stage:               z.string().min(1),
  estimated_anp:       z.string().optional().or(z.literal('')),
  estimated_fyc:       z.string().optional().or(z.literal('')),
  probability:         z.string().optional().or(z.literal('')),
  expected_close_date: z.string().optional().or(z.literal('')),
  next_action:         z.string().optional().or(z.literal('')),
  next_action_date:    z.string().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  opportunity?: Opportunity | null
  clientId: string
  userId: string
  onClose: () => void
  onSaved: () => void
}

const PRODUCT_TYPES = [
  { value: 'life_insurance',       label: 'Life Insurance' },
  { value: 'health_insurance',     label: 'Health Insurance' },
  { value: 'investment',           label: 'Investment' },
  { value: 'retirement',           label: 'Retirement' },
  { value: 'annuity',              label: 'Annuity' },
  { value: 'disability',           label: 'Disability' },
  { value: 'critical_illness',     label: 'Critical Illness' },
  { value: 'general_insurance',    label: 'General Insurance' },
  { value: 'other',                label: 'Other' },
]

const STAGES = [
  { value: 'new_lead',         label: 'New Lead' },
  { value: 'contacted',        label: 'Contacted' },
  { value: 'appointment_set',  label: 'Appointment Set' },
  { value: 'fact_find',        label: 'Fact Find' },
  { value: 'proposal',         label: 'Proposal' },
  { value: 'closing',          label: 'Closing' },
  { value: 'won',              label: 'Won' },
  { value: 'lost',             label: 'Lost' },
  { value: 'follow_up_later',  label: 'Follow Up Later' },
]

export default function OpportunityModal({
  open, opportunity, clientId, userId, onClose, onSaved,
}: Props) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '', product_type: '', stage: 'new_lead',
      estimated_anp: '', estimated_fyc: '', probability: '50',
      expected_close_date: '', next_action: '', next_action_date: '',
    },
  })

  useEffect(() => {
    if (!open) return
    if (opportunity) {
      reset({
        title:               opportunity.title,
        product_type:        opportunity.product_type ?? '',
        stage:               opportunity.stage,
        estimated_anp:       opportunity.estimated_anp != null ? String(opportunity.estimated_anp) : '',
        estimated_fyc:       opportunity.estimated_fyc != null ? String(opportunity.estimated_fyc) : '',
        probability:         String(opportunity.probability),
        expected_close_date: opportunity.expected_close_date ?? '',
        next_action:         opportunity.next_action ?? '',
        next_action_date:    opportunity.next_action_date ?? '',
      })
    } else {
      reset({
        title: '', product_type: '', stage: 'new_lead',
        estimated_anp: '', estimated_fyc: '', probability: '50',
        expected_close_date: '', next_action: '', next_action_date: '',
      })
    }
  }, [open, opportunity?.id])

  async function onSubmit(values: FormValues) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = createClient() as any
    const payload = {
      title:               values.title,
      product_type:        (values.product_type || null) as Opportunity['product_type'],
      stage:               values.stage as Opportunity['stage'],
      estimated_anp:       values.estimated_anp ? parseFloat(values.estimated_anp) : null,
      estimated_fyc:       values.estimated_fyc ? parseFloat(values.estimated_fyc) : null,
      probability:         values.probability ? parseInt(values.probability) : 50,
      expected_close_date: values.expected_close_date || null,
      next_action:         values.next_action || null,
      next_action_date:    values.next_action_date || null,
      client_id:           clientId,
      user_id:             userId,
    }
    if (opportunity) {
      const { error } = await db.from('opportunities').update(payload).eq('id', opportunity.id)
      if (error) throw error
    } else {
      const { error } = await db.from('opportunities').insert(payload)
      if (error) throw error
    }
    onSaved()
  }

  if (!open) return null

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            {opportunity ? 'Edit Opportunity' : 'New Opportunity'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              {...register('title')}
              className={inputCls}
              placeholder="e.g. Term Life Insurance — $1M cover"
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Product Type</label>
              <select {...register('product_type')} className={inputCls}>
                <option value="">Select type…</option>
                {PRODUCT_TYPES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Stage</label>
              <select {...register('stage')} className={inputCls}>
                {STAGES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Est. ANP ($)</label>
              <input type="number" {...register('estimated_anp')} className={inputCls} placeholder="0" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Est. FYC ($)</label>
              <input type="number" {...register('estimated_fyc')} className={inputCls} placeholder="0" min="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Probability %</label>
              <input type="number" {...register('probability')} className={inputCls} min="0" max="100" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Expected Close Date</label>
            <input type="date" {...register('expected_close_date')} className={inputCls} />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Next Action</label>
            <input
              {...register('next_action')}
              className={inputCls}
              placeholder="What's the next step?"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Next Action Date</label>
            <input type="date" {...register('next_action_date')} className={inputCls} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-70 transition-colors"
          >
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {opportunity ? 'Save Changes' : 'Create Opportunity'}
          </button>
        </div>
      </div>
    </div>
  )
}
