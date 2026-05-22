'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  Plus, Trash2, Check, Info, ShieldCheck, BarChart3,
  Target, BookOpen, PenLine, Loader2, RotateCcw, ClipboardCheck,
  Lightbulb, Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatCurrency } from '@/lib/utils'
import type {
  Client, PlanningChecklist,
  RetirementProfile, RetirementActionItem,
  InsertRetirementProfile, InsertRetirementActionItem,
} from '@/types/database'
import { generatePlanningIntelligence, type PlanningIntelligence } from './retirementIntelligence'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  client:            Client
  checklist:         PlanningChecklist[]
  initialProfile:    RetirementProfile | null
  initialActions:    RetirementActionItem[]
  userId:            string
}

interface ValidationError {
  field: string
  message: string
}

// ─── Checklist category keys — must match CoverageChecklist.tsx CHECKLIST_CATEGORIES ─

const COVERAGE_KEYS = {
  life:     'Life',
  tpd:      'Total Permanent Disability',
  ci:       'Critical Illness',
  add:      'Accidental Death and Disability',
  ltc:      'Long-Term Care',
  hs:       'Hospital and Surgical',
  si:       'Savings & Investments',
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTES_CATEGORIES = [
  { value: 'general',    label: 'General' },
  { value: 'risk',       label: 'Risk & Protection' },
  { value: 'cpf',        label: 'CPF Strategy' },
  { value: 'investment', label: 'Investment' },
  { value: 'estate',     label: 'Estate Planning' },
  { value: 'cashflow',   label: 'Cash Flow' },
]

const ACTION_CATEGORIES = [
  { value: 'general',    label: 'General' },
  { value: 'savings',    label: 'Savings' },
  { value: 'cpf',        label: 'CPF' },
  { value: 'investment', label: 'Investment' },
  { value: 'protection', label: 'Protection' },
  { value: 'estate',     label: 'Estate' },
  { value: 'healthcare', label: 'Healthcare' },
]

const ALLOC_COLORS: Record<string, string> = {
  equities: '#6366f1',
  bonds:    '#06b6d4',
  cash:     '#10b981',
  property: '#f59e0b',
  cpf:      '#8b5cf6',
  others:   '#94a3b8',
}

// ─── Calculation helpers ──────────────────────────────────────────────────────

function safeNum(v: number | null | undefined, fallback = 0): number {
  const n = v ?? fallback
  return isFinite(n) ? n : fallback
}

function futureValue(pv: number, rate: number, years: number): number {
  if (years === 0) return pv
  return pv * Math.pow(1 + rate, years)
}

function fvAnnuity(pmt: number, rate: number, years: number): number {
  if (years === 0) return 0
  if (rate === 0) return pmt * 12 * years
  const mr = rate / 12
  const m  = years * 12
  return pmt * ((Math.pow(1 + mr, m) - 1) / mr)
}

function pvAnnuity(pmt: number, rate: number, years: number): number {
  if (years === 0 || pmt === 0) return 0
  if (rate === 0) return pmt * 12 * years
  const mr = rate / 12
  const m  = years * 12
  return pmt * ((1 - Math.pow(1 + mr, -m)) / mr)
}

interface FocusArea {
  key:      string
  title:    string
  priority: 'critical' | 'important' | 'recommended'
  reason:   string
  meaning:  string
  angle:    string
  steps:    string[]
}

interface RetirementCalc {
  yearsToRetire:            number
  retirementDuration:       number
  inflationAdjMonthlyNeeds: number
  totalAssetsToday:         number
  projectedAssets:          number
  retirementCorpusNeeded:   number
  passiveIncomePV:          number
  gap:                      number
  gapMonthly:               number
  readinessScore:           number
  status:                   'on_track' | 'slightly_behind' | 'moderate_shortfall' | 'high_risk'
  cpfTotal:                 number
  cpfMaFunded:              boolean
  cpfBrsReached:            boolean
  cpfFrsReached:            boolean
  coverageScore:            number
  topFocusAreas:            FocusArea[]
  savingsRate:              number
  passiveIncomeMonthly:     number
  validationErrors:         ValidationError[]
}

function computeRetirement(
  p: Partial<RetirementProfile> | null,
  client: Client,
  checklist: PlanningChecklist[],
): RetirementCalc | null {
  if (!p) return null
  if (!client.age) return null

  const currentAge     = client.age
  const retireAge      = safeNum(p.target_retirement_age, 65)
  const lifeExp        = safeNum(p.life_expectancy, 85)
  const infRate        = safeNum(p.inflation_rate, 0.03)
  const preRetRate     = safeNum(p.expected_return_rate, 0.05)
  const postRetRate    = safeNum((p as RetirementProfile).post_retirement_return_rate, 0.035)
  const retNeeds       = safeNum(p.retirement_monthly_needs, 0)

  // ── Validation errors (non-fatal — still compute, but show warnings) ────────
  const validationErrors: ValidationError[] = []
  if (retireAge <= currentAge) {
    validationErrors.push({ field: 'target_retirement_age', message: `Retirement age (${retireAge}) must be greater than current age (${currentAge}).` })
  }
  if (lifeExp <= retireAge) {
    validationErrors.push({ field: 'life_expectancy', message: `Life expectancy (${lifeExp}) must be greater than retirement age (${retireAge}).` })
  }
  if (retireAge < 55 || retireAge > 100) {
    validationErrors.push({ field: 'target_retirement_age', message: `Retirement age should be between 55 and 100.` })
  }

  const ytr    = Math.max(0, retireAge - currentAge)
  const retDur = Math.max(0, lifeExp - retireAge)

  // Inflation-adjusted monthly needs at retirement start
  const adjNeeds = retNeeds * Math.pow(1 + infRate, ytr)

  // Investable assets today (exclude property)
  const totalAssets =
    safeNum(p.current_savings) +
    safeNum(p.cpf_ordinary_account) +
    safeNum(p.cpf_special_account) +
    safeNum(p.investment_portfolio) +
    safeNum(p.other_assets)

  // CPF total (OA + SA + MA)
  const cpfTotal =
    safeNum(p.cpf_ordinary_account) +
    safeNum(p.cpf_special_account) +
    safeNum(p.cpf_medisave_account)

  // Monthly contributions to grow
  const totalMonthlyContrib =
    safeNum(p.monthly_savings_contribution) +
    safeNum(p.monthly_investment_contribution)
  const totalCpfMonthly =
    safeNum(p.monthly_cpf_employee) +
    safeNum(p.monthly_cpf_employer)

  // Project assets to retirement using pre-retirement return rate
  const fvExisting    = futureValue(totalAssets, preRetRate, ytr)
  const fvContribs    = fvAnnuity(totalMonthlyContrib, preRetRate, ytr)
  const fvCpfContribs = fvAnnuity(totalCpfMonthly, preRetRate, ytr)
  const projectedAssets = fvExisting + fvContribs + fvCpfContribs

  // Corpus needed to fund inflation-adjusted retirement using POST-retirement rate
  // Real rate approach: adjust monthly payment upward over retirement by inflation
  // Simplified: PV of constant adjNeeds over retDur at postRetRate
  const corpusNeeded = pvAnnuity(adjNeeds, postRetRate, retDur)

  // PV of passive income streams at retirement (using post-retirement rate)
  const passiveIncomeMonthly =
    safeNum(p.cpf_life_monthly) +
    safeNum(p.rental_income_monthly) +
    safeNum(p.part_time_income_monthly) +
    safeNum(p.other_income_monthly)
  const passivePV = pvAnnuity(passiveIncomeMonthly, postRetRate, retDur)

  const netCorpusNeeded = Math.max(0, corpusNeeded - passivePV)
  const gap = netCorpusNeeded - projectedAssets

  // Monthly extra needed to close gap
  const annuityFactor = fvAnnuity(1, preRetRate, ytr)
  const gapMonthly = gap > 0 && ytr > 0 && annuityFactor > 0
    ? gap / annuityFactor
    : 0

  // ── Readiness score ─────────────────────────────────────────────────────────

  // Coverage ratio (40 pts): projected / needed, capped at 100%
  const coverageRatio = netCorpusNeeded > 0 ? Math.min(1, projectedAssets / netCorpusNeeded) : 1
  const coveragePts   = Math.round(coverageRatio * 40)

  // Savings discipline (20 pts): actual income > estimated from expenses
  const actualIncome    = safeNum((p as RetirementProfile).current_monthly_income) ||
                          safeNum(p.current_monthly_expenses) * 1.4
  const totalSavings    = totalMonthlyContrib + totalCpfMonthly
  const savingsRate     = actualIncome > 0 ? totalSavings / actualIncome : 0
  const savingsPts      = Math.min(20, Math.round((savingsRate / 0.20) * 20))

  // CPF LIFE coverage (15 pts)
  const cpfLifeMonthly  = safeNum(p.cpf_life_monthly)
  const cpfLifePts      = cpfLifeMonthly >= 2000 ? 15 : cpfLifeMonthly >= 1300 ? 10 : cpfLifeMonthly > 0 ? 5 : 0
  const cpfBrsReached   = cpfTotal >= 99400
  const cpfFrsReached   = cpfTotal >= 198800
  const cpfMaFunded     = safeNum(p.cpf_medisave_account) >= 66000

  // Protection score (15 pts): uses correct category keys
  const lifeItem = checklist.find(c => c.category_name === COVERAGE_KEYS.life)
  const ciItem   = checklist.find(c => c.category_name === COVERAGE_KEYS.ci)
  const tpdItem  = checklist.find(c => c.category_name === COVERAGE_KEYS.tpd)
  const hsItem   = checklist.find(c => c.category_name === COVERAGE_KEYS.hs)
  const ltcItem  = checklist.find(c => c.category_name === COVERAGE_KEYS.ltc)

  const isCovered = (item: PlanningChecklist | undefined) =>
    item ? (item.is_fulfilled || (item.coverage_pct ?? 0) > 0) : false

  const protectionCovered = [lifeItem, ciItem, tpdItem, hsItem].filter(isCovered).length
  const coverageScore     = Math.round((protectionCovered / 4) * 15)

  // Healthcare (10 pts): MediSave + Shield
  const maPts       = cpfMaFunded ? 5 : Math.round(Math.min(1, safeNum(p.cpf_medisave_account) / 66000) * 5)
  const shieldPts   = hsItem
    ? (hsItem.is_fulfilled ? 5 : Math.round(((hsItem.coverage_pct ?? 0) / 100) * 5))
    : 0
  const healthcarePts = maPts + shieldPts

  const readinessScore = Math.min(100,
    coveragePts + savingsPts + cpfLifePts + coverageScore + healthcarePts
  )

  const status: RetirementCalc['status'] =
    readinessScore >= 80 ? 'on_track' :
    readinessScore >= 60 ? 'slightly_behind' :
    readinessScore >= 40 ? 'moderate_shortfall' :
    'high_risk'

  // ── Top Focus Areas ──────────────────────────────────────────────────────────
  const areas: FocusArea[] = []

  // 1. Retirement Income Gap
  if (gap > 0) {
    const severity = gap / Math.max(netCorpusNeeded, 1)
    areas.push({
      key:      'gap',
      title:    'Retirement Income Gap',
      priority: severity > 0.5 ? 'critical' : 'important',
      reason:   `Projected assets of ${formatCurrency(projectedAssets)} fall ${formatCurrency(gap)} short of the corpus required.`,
      meaning:  'Without action, the client risks running out of money during retirement.',
      angle:    'How would your lifestyle change if your savings ran out 10 years before you planned?',
      steps:    [
        `Increase monthly contributions by approximately ${formatCurrency(gapMonthly)} to bridge the gap`,
        'Review asset allocation to target a higher long-run return',
        'Consider delaying retirement by 2–3 years to compound more savings',
      ],
    })
  }

  // 2. Low Monthly Accumulation / Weak Savings Discipline
  if (savingsRate < 0.15) {
    areas.push({
      key:      'savings',
      title:    'Low Monthly Accumulation',
      priority: savingsRate < 0.08 ? 'critical' : 'important',
      reason:   `Estimated savings rate is ${(savingsRate * 100).toFixed(1)}% — below the 15–20% recommended minimum.`,
      meaning:  'Insufficient monthly savings means the retirement corpus compounds slowly, widening the gap over time.',
      angle:    'What would need to change in your monthly cash flow to set aside an extra $500–$1,000?',
      steps:    [
        'Set up an automated recurring transfer on every payday',
        'Identify and cut 2–3 recurring discretionary expenses',
        'Maximise CPF Voluntary Contributions (VC) for tax savings',
      ],
    })
  }

  // 3. Cash-Heavy Portfolio
  const totalInvestable = totalAssets
  const cashPct = totalInvestable > 0 && safeNum(p.current_savings) / totalInvestable > 0.4
  if (cashPct && ytr > 5) {
    areas.push({
      key:      'cash_heavy',
      title:    'Too Cash-Heavy',
      priority: 'important',
      reason:   `Cash and savings make up over 40% of investable assets, generating returns well below inflation.`,
      meaning:  'Idle cash loses purchasing power each year. With a long runway before retirement, it should be put to work.',
      angle:    'How comfortable are you with seeing your portfolio fluctuate month-to-month in exchange for higher long-term growth?',
      steps:    [
        'Move excess cash above a 6-month emergency fund into a Regular Savings Plan (RSP) or ETF',
        'Consider Singapore Savings Bonds (SSB) for a safer intermediate step',
        'Review CPF OA balance — consider CPFIS if OA return targets can be beaten',
      ],
    })
  }

  // 4. Weak Investment Participation
  const investPct = totalInvestable > 0
    ? safeNum(p.investment_portfolio) / totalInvestable
    : 0
  if (investPct < 0.2 && ytr > 10) {
    areas.push({
      key:      'weak_invest',
      title:    'Weak Investment Participation',
      priority: 'recommended',
      reason:   `Investment assets represent ${(investPct * 100).toFixed(0)}% of the portfolio, limiting long-term compounding.`,
      meaning:  'CPF and savings alone are unlikely to beat inflation over 20+ years. Diversified investments are needed.',
      angle:    'Have you explored unit trusts, ETFs, or endowment plans that could grow your wealth systematically?',
      steps:    [
        'Start with a low-cost, diversified ETF RSP aligned to risk profile',
        'Consider Investment-Linked Policies (ILPs) for blended protection + investment',
        'Review the CPF Investment Scheme (CPFIS) eligibility',
      ],
    })
  }

  // 5. CPF LIFE Shortfall
  if (!cpfFrsReached && retireAge >= 55) {
    areas.push({
      key:      'cpf',
      title:    'CPF LIFE Income Floor Shortfall',
      priority: cpfBrsReached ? 'recommended' : 'important',
      reason:   `Combined CPF (OA + SA + MA) of ${formatCurrency(cpfTotal)} has not reached the Full Retirement Sum of $198,800.`,
      meaning:  'A lower CPF balance means reduced CPF LIFE monthly payouts — shrinking the guaranteed income floor in retirement.',
      angle:    'Would you feel more secure knowing a fixed amount arrives every month regardless of market conditions?',
      steps:    [
        'Top up CPF SA/RA via the Retirement Sum Topping-Up Scheme (RSTU) — tax deductible up to $8,000/year',
        'Consider deferring CPF LIFE start date to age 70 for a 35% higher monthly payout',
        'Review if Retirement Sum (ERS) top-up is eligible for enhanced payout',
      ],
    })
  }

  // 6. Protection Gaps
  if (coverageScore < 10) {
    areas.push({
      key:      'protection',
      title:    'Protection Coverage Gaps',
      priority: coverageScore === 0 ? 'critical' : 'important',
      reason:   'One or more key coverage categories (Life, CI, TPD, Shield) are missing or undercovered.',
      meaning:  'A major illness or disability before retirement can permanently deplete savings and derail the retirement plan.',
      angle:    'If you were hospitalised for 3 months tomorrow, which bills would your family struggle to pay?',
      steps:    [
        'Review Life Insurance sum assured — typically 10× annual income',
        'Ensure an Early Critical Illness (ECI) plan is in place',
        'Confirm MediShield Life + Integrated Shield Plan (IP) is active',
      ],
    })
  }

  // 7. Long-Term Care Risk
  if (!isCovered(ltcItem) && lifeExp > 80) {
    areas.push({
      key:      'ltc',
      title:    'Long-Term Care Risk',
      priority: 'recommended',
      reason:   'No Long-Term Care coverage is recorded. With life expectancy above 80, LTC costs are a meaningful risk.',
      meaning:  'Eldercare can cost $2,000–$5,000/month. Without an LTC plan, this drains retirement savings rapidly.',
      angle:    'Have you thought about how you would fund care if you could no longer perform basic daily activities?',
      steps:    [
        'Review ElderShield / CareShield Life enrolment status and adequacy',
        'Consider a CareShield Life supplement for enhanced daily benefit',
        'Set aside a dedicated healthcare reserve of at least $100,000 by retirement',
      ],
    })
  }

  // 8. Healthcare Cost Risk (MediSave)
  if (!cpfMaFunded) {
    areas.push({
      key:      'medisave',
      title:    'Healthcare Cost Risk',
      priority: 'recommended',
      reason:   `MediSave balance of ${formatCurrency(safeNum(p.cpf_medisave_account))} is below the Basic Healthcare Sum (BHS) of $66,000.`,
      meaning:  'Insufficient MediSave limits ability to pay for hospitalisation, outpatient procedures, and Integrated Shield Plan premiums in retirement.',
      angle:    'Medical costs typically double in your 70s and 80s — how are you building this buffer?',
      steps:    [
        'Make voluntary cash top-ups to MediSave (up to $8,000/year for tax relief)',
        'Confirm Integrated Shield Plan is active and premiums can be paid from MediSave',
      ],
    })
  }

  // 9. Retirement Age Adjustment
  if (ytr > 0 && retireAge > 0 && gap > netCorpusNeeded * 0.3 && ytr < 15) {
    areas.push({
      key:      'retire_age',
      title:    'Retirement Age Adjustment',
      priority: 'important',
      reason:   `With a significant shortfall and only ${ytr} years to retirement, extending the working timeline is the highest-leverage lever.`,
      meaning:  'Each additional working year adds contributions AND defers drawdown, dramatically reducing the required corpus.',
      angle:    'If working 3 more years meant a fully funded retirement — is that trade-off worth exploring?',
      steps:    [
        `Modelling shows a ${Math.min(5, Math.ceil(ytr * 0.2))}–year extension significantly closes the gap`,
        'Consider phased retirement: part-time consulting while drawing partial CPF',
        'Align retirement date with CPF LIFE start date for maximum income floor',
      ],
    })
  }

  // 10. Income Floor Building
  if (passiveIncomeMonthly < adjNeeds * 0.5 && retDur > 15) {
    areas.push({
      key:      'income_floor',
      title:    'Income Floor Building',
      priority: 'recommended',
      reason:   `Guaranteed passive income of ${formatCurrency(passiveIncomeMonthly)}/mo covers only ${Math.round((passiveIncomeMonthly / Math.max(adjNeeds, 1)) * 100)}% of projected monthly needs.`,
      meaning:  'Without a reliable income floor, the client depends entirely on drawdowns — vulnerable to market downturns early in retirement.',
      angle:    'How would you feel if markets fell 30% in the first year of your retirement?',
      steps:    [
        'Prioritise building CPF LIFE to FRS/ERS for maximum guaranteed payout',
        'Consider annuity products to lock in a lifetime income stream',
        'Explore Singapore Savings Bonds (SSB) for a low-risk income layer',
      ],
    })
  }

  // 11. Legacy & Estate Planning (only if well-funded)
  if (gap <= 0 && coverageScore >= 10 && readinessScore >= 80) {
    areas.push({
      key:      'estate',
      title:    'Legacy & Estate Planning',
      priority: 'recommended',
      reason:   'Retirement funding appears well on track. Attention can shift to wealth transfer and legacy.',
      meaning:  'Without a plan, assets may not reach intended beneficiaries efficiently, and estate administration can be costly and time-consuming.',
      angle:    'Have you thought about what kind of legacy you want to leave, and whether your CPF nomination reflects that?',
      steps:    [
        'Review and update CPF nomination for all accounts',
        'Draft or review a Will and Lasting Power of Attorney (LPA)',
        'Explore whole life or legacy endowment for tax-efficient wealth transfer',
      ],
    })
  }

  const topFocusAreas = areas
    .sort((a, b) => {
      const o = { critical: 0, important: 1, recommended: 2 }
      return o[a.priority] - o[b.priority]
    })
    .slice(0, 3)

  return {
    yearsToRetire: ytr,
    retirementDuration: retDur,
    inflationAdjMonthlyNeeds: adjNeeds,
    totalAssetsToday: totalAssets,
    projectedAssets,
    retirementCorpusNeeded: netCorpusNeeded,
    passiveIncomePV: passivePV,
    gap,
    gapMonthly,
    readinessScore,
    status,
    cpfTotal,
    cpfMaFunded,
    cpfBrsReached,
    cpfFrsReached,
    coverageScore,
    topFocusAreas,
    savingsRate,
    passiveIncomeMonthly,
    validationErrors,
  }
}

// ─── SVG Readiness Gauge ──────────────────────────────────────────────────────

function ReadinessGauge({ score }: { score: number }) {
  const pct        = Math.min(1, Math.max(0, score / 100))
  const R          = 54
  const cx         = 70
  const cy         = 70
  const startAngle = -210
  const sweepAngle = 240
  const endAngle   = startAngle + sweepAngle * pct

  function ptXY(deg: number) {
    const rad = (deg * Math.PI) / 180
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) }
  }

  function arcD(a1: number, a2: number) {
    const s = ptXY(a1), e = ptXY(a2)
    const large = Math.abs(a2 - a1) > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`
  }

  const fillColor =
    score >= 80 ? '#10b981' :
    score >= 60 ? '#6366f1' :
    score >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 140 110" className="w-36 h-28">
      <path d={arcD(startAngle, startAngle + sweepAngle)} fill="none" stroke="#e2e8f0" strokeWidth={10} strokeLinecap="round" />
      {pct > 0.01 && (
        <path d={arcD(startAngle, endAngle)} fill="none" stroke={fillColor} strokeWidth={10} strokeLinecap="round" />
      )}
      <text x={cx} y={cy + 4}  textAnchor="middle" fontSize={22} fontWeight="700" fill={fillColor}>{score}</text>
      <text x={cx} y={cy + 19} textAnchor="middle" fontSize={9}  fill="#94a3b8">/ 100</text>
    </svg>
  )
}

// ─── Gap Bar ──────────────────────────────────────────────────────────────────

function GapBar({ projected, needed }: { projected: number; needed: number }) {
  if (needed <= 0 && projected <= 0) return null
  const max      = Math.max(projected, needed, 1)
  const projPct  = Math.min(100, (projected / max) * 100)
  const needPct  = Math.min(100, (needed  / max) * 100)
  const surplus  = projected >= needed

  return (
    <div className="space-y-2">
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Projected Assets at Retirement</span>
          <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(projected)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div className={cn('h-full rounded-full', surplus ? 'bg-emerald-500' : 'bg-indigo-500')} style={{ width: `${projPct}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Corpus Required</span>
          <span className="font-semibold text-slate-700 tabular-nums">{formatCurrency(needed)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full rounded-full bg-slate-400" style={{ width: `${needPct}%` }} />
        </div>
      </div>
    </div>
  )
}

// ─── Allocation Donut ─────────────────────────────────────────────────────────

function AllocationDonut({ slices }: { slices: { label: string; key: string; pct: number }[] }) {
  const valid = slices.filter(s => Number.isFinite(s.pct) && s.pct > 0)
  if (valid.length === 0) {
    return <p className="text-xs text-slate-400 text-center py-4">No allocation data entered</p>
  }

  const total = valid.reduce((s, x) => s + x.pct, 0)
  const CX = 70, CY = 70, RO = 54, RI = 32

  function polar(angle: number, r: number) {
    const rad = (angle - 90) * (Math.PI / 180)
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)]
  }

  function arc(a1: number, a2: number) {
    if (Math.abs(a2 - a1) < 0.1) return ''
    const [sx, sy] = polar(a1, RO), [ex, ey] = polar(a2, RO)
    const [ix, iy] = polar(a2, RI), [jx, jy] = polar(a1, RI)
    const large = a2 - a1 > 180 ? 1 : 0
    return `M ${sx} ${sy} A ${RO} ${RO} 0 ${large} 1 ${ex} ${ey} L ${ix} ${iy} A ${RI} ${RI} 0 ${large} 0 ${jx} ${jy} Z`
  }

  let cur = 0
  const paths = valid.map(s => {
    const sweep = (s.pct / total) * 360
    const d = arc(cur, cur + sweep - 0.5)
    cur += sweep
    return { ...s, d }
  })

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 140 140" className="w-28 h-28 shrink-0">
        {paths.map(p => <path key={p.key} d={p.d} fill={ALLOC_COLORS[p.key] ?? '#94a3b8'} />)}
      </svg>
      <div className="space-y-1.5 flex-1">
        {valid.map(s => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: ALLOC_COLORS[s.key] ?? '#94a3b8' }} />
            <span className="text-xs text-slate-600 flex-1">{s.label}</span>
            <span className="text-xs font-semibold text-slate-700 tabular-nums">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormData {
  target_retirement_age:            string
  life_expectancy:                  string
  current_monthly_income:           string
  current_monthly_expenses:         string
  retirement_monthly_needs:         string
  inflation_rate:                   string
  expected_return_rate:             string
  post_retirement_return_rate:      string
  current_savings:                  string
  cpf_ordinary_account:             string
  cpf_special_account:              string
  cpf_medisave_account:             string
  investment_portfolio:             string
  property_value:                   string
  property_mortgage_outstanding:    string
  other_assets:                     string
  cpf_life_monthly:                 string
  rental_income_monthly:            string
  part_time_income_monthly:         string
  other_income_monthly:             string
  monthly_savings_contribution:     string
  monthly_cpf_employee:             string
  monthly_cpf_employer:             string
  monthly_investment_contribution:  string
  alloc_equities:                   string
  alloc_bonds:                      string
  alloc_cash:                       string
  alloc_property:                   string
  alloc_cpf:                        string
  alloc_others:                     string
}

function profileToForm(p: RetirementProfile | null): FormData {
  const n  = (v: number | null | undefined) => v == null ? '' : String(v)
  const pctStr = (v: number | null | undefined, def: number) => n(p ? (v ?? def) * 100 : def)
  return {
    target_retirement_age:           n(p?.target_retirement_age),
    life_expectancy:                 n(p?.life_expectancy ?? 85),
    current_monthly_income:          n(p?.current_monthly_income),
    current_monthly_expenses:        n(p?.current_monthly_expenses),
    retirement_monthly_needs:        n(p?.retirement_monthly_needs),
    inflation_rate:                  pctStr(p?.inflation_rate, 0.03),
    expected_return_rate:            pctStr(p?.expected_return_rate, 0.05),
    post_retirement_return_rate:     pctStr(p?.post_retirement_return_rate, 0.035),
    current_savings:                 n(p?.current_savings ?? 0),
    cpf_ordinary_account:            n(p?.cpf_ordinary_account ?? 0),
    cpf_special_account:             n(p?.cpf_special_account ?? 0),
    cpf_medisave_account:            n(p?.cpf_medisave_account ?? 0),
    investment_portfolio:            n(p?.investment_portfolio ?? 0),
    property_value:                  n(p?.property_value ?? 0),
    property_mortgage_outstanding:   n(p?.property_mortgage_outstanding ?? 0),
    other_assets:                    n(p?.other_assets ?? 0),
    cpf_life_monthly:                n(p?.cpf_life_monthly ?? 0),
    rental_income_monthly:           n(p?.rental_income_monthly ?? 0),
    part_time_income_monthly:        n(p?.part_time_income_monthly ?? 0),
    other_income_monthly:            n(p?.other_income_monthly ?? 0),
    monthly_savings_contribution:    n(p?.monthly_savings_contribution ?? 0),
    monthly_cpf_employee:            n(p?.monthly_cpf_employee ?? 0),
    monthly_cpf_employer:            n(p?.monthly_cpf_employer ?? 0),
    monthly_investment_contribution: n(p?.monthly_investment_contribution ?? 0),
    alloc_equities:                  n(p?.alloc_equities ?? 0),
    alloc_bonds:                     n(p?.alloc_bonds ?? 0),
    alloc_cash:                      n(p?.alloc_cash ?? 0),
    alloc_property:                  n(p?.alloc_property ?? 0),
    alloc_cpf:                       n(p?.alloc_cpf ?? 0),
    alloc_others:                    n(p?.alloc_others ?? 0),
  }
}

function formToProfile(f: FormData): Partial<InsertRetirementProfile> {
  const num = (v: string) => v === '' ? null : parseFloat(v)
  const pct = (v: string) => v === '' ? null : parseFloat(v) / 100
  const int = (v: string) => v === '' ? null : parseInt(v, 10)
  return {
    target_retirement_age:           int(f.target_retirement_age),
    life_expectancy:                 int(f.life_expectancy),
    current_monthly_income:          num(f.current_monthly_income),
    current_monthly_expenses:        num(f.current_monthly_expenses),
    retirement_monthly_needs:        num(f.retirement_monthly_needs),
    inflation_rate:                  pct(f.inflation_rate),
    expected_return_rate:            pct(f.expected_return_rate),
    post_retirement_return_rate:     pct(f.post_retirement_return_rate),
    current_savings:                 num(f.current_savings),
    cpf_ordinary_account:            num(f.cpf_ordinary_account),
    cpf_special_account:             num(f.cpf_special_account),
    cpf_medisave_account:            num(f.cpf_medisave_account),
    investment_portfolio:            num(f.investment_portfolio),
    property_value:                  num(f.property_value),
    property_mortgage_outstanding:   num(f.property_mortgage_outstanding),
    other_assets:                    num(f.other_assets),
    cpf_life_monthly:                num(f.cpf_life_monthly),
    rental_income_monthly:           num(f.rental_income_monthly),
    part_time_income_monthly:        num(f.part_time_income_monthly),
    other_income_monthly:            num(f.other_income_monthly),
    monthly_savings_contribution:    num(f.monthly_savings_contribution),
    monthly_cpf_employee:            num(f.monthly_cpf_employee),
    monthly_cpf_employer:            num(f.monthly_cpf_employer),
    monthly_investment_contribution: num(f.monthly_investment_contribution),
    alloc_equities:                  int(f.alloc_equities),
    alloc_bonds:                     int(f.alloc_bonds),
    alloc_cash:                      int(f.alloc_cash),
    alloc_property:                  int(f.alloc_property),
    alloc_cpf:                       int(f.alloc_cpf),
    alloc_others:                    int(f.alloc_others),
  }
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-slate-700">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && <div className="px-5 pb-5 border-t border-slate-100">{children}</div>}
    </div>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3 mt-5">{label}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function NumberInput({ label, value, onChange, prefix, suffix, hint, error }: {
  label: string; value: string; onChange: (v: string) => void
  prefix?: string; suffix?: string; hint?: string; error?: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <div className={cn(
        'flex items-center border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 bg-white',
        error ? 'border-red-300 focus-within:border-red-400' : 'border-slate-200 focus-within:border-indigo-400'
      )}>
        {prefix && <span className="px-2.5 text-xs text-slate-400 bg-slate-50 border-r border-slate-200 self-stretch flex items-center">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="flex-1 px-2.5 py-2 text-sm text-slate-800 bg-transparent outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          placeholder="0"
        />
        {suffix && <span className="px-2.5 text-xs text-slate-400 bg-slate-50 border-l border-slate-200 self-stretch flex items-center">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  )
}

function MetricCard({ label, value, sub, accent }: {
  label: string; value: string; sub?: string; accent?: 'emerald' | 'indigo' | 'amber' | 'red' | 'slate'
}) {
  const colors = { emerald: 'text-emerald-600', indigo: 'text-indigo-600', amber: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-700' }
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white shadow-sm p-4">
      <p className="text-xs text-slate-500 mb-1 leading-tight">{label}</p>
      <p className={cn('text-lg font-bold tabular-nums', colors[accent ?? 'slate'])}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function StatusBanner({ status, score }: { status: RetirementCalc['status']; score: number }) {
  const config = {
    on_track:           { label: 'On Track',           Icon: CheckCircle2,  bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', ic: 'text-emerald-500' },
    slightly_behind:    { label: 'Slightly Behind',    Icon: TrendingDown,  bg: 'bg-indigo-50 border-indigo-200',   text: 'text-indigo-700',  ic: 'text-indigo-500' },
    moderate_shortfall: { label: 'Moderate Shortfall', Icon: AlertTriangle, bg: 'bg-amber-50 border-amber-200',    text: 'text-amber-700',   ic: 'text-amber-500' },
    high_risk:          { label: 'High Risk',           Icon: AlertTriangle, bg: 'bg-red-50 border-red-200',        text: 'text-red-700',     ic: 'text-red-500' },
  }
  const c = config[status]
  return (
    <div className={cn('flex items-center gap-2.5 px-4 py-3 rounded-xl border text-sm font-medium', c.bg, c.text)}>
      <c.Icon className={cn('h-4 w-4 shrink-0', c.ic)} />
      <span>Retirement Readiness: <strong>{c.label}</strong> — Score {score}/100</span>
    </div>
  )
}

// ─── Auto action items ────────────────────────────────────────────────────────

function buildAutoActions(calc: RetirementCalc): Omit<InsertRetirementActionItem, 'user_id' | 'client_id'>[] {
  const items: Omit<InsertRetirementActionItem, 'user_id' | 'client_id'>[] = []
  let order = 0

  if (calc.gap > 0)
    items.push({ label: `Increase monthly contributions by ${formatCurrency(calc.gapMonthly)} to close retirement gap`, category: 'savings',    is_completed: false, is_custom: false, sort_order: order++ })
  if (calc.savingsRate < 0.15)
    items.push({ label: 'Set up automated savings transfer on every payday', category: 'savings',    is_completed: false, is_custom: false, sort_order: order++ })
  if (!calc.cpfFrsReached)
    items.push({ label: `Top up CPF SA/RA to reach Full Retirement Sum ($198,800) — current: ${formatCurrency(calc.cpfTotal)}`, category: 'cpf', is_completed: false, is_custom: false, sort_order: order++ })
  if (!calc.cpfMaFunded)
    items.push({ label: 'Top up MediSave to Basic Healthcare Sum ($66,000) for tax relief', category: 'healthcare', is_completed: false, is_custom: false, sort_order: order++ })
  if (calc.coverageScore < 10)
    items.push({ label: 'Review protection coverage — Life, CI, TPD and Shield gaps found', category: 'protection', is_completed: false, is_custom: false, sort_order: order++ })
  if (calc.gap <= 0 && calc.readinessScore >= 80) {
    items.push({ label: 'Review CPF nomination and beneficiary designations', category: 'estate', is_completed: false, is_custom: false, sort_order: order++ })
    items.push({ label: 'Consider drafting a Will and Lasting Power of Attorney (LPA)', category: 'estate', is_completed: false, is_custom: false, sort_order: order++ })
  }
  return items
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RetirementReport({ client, checklist, initialProfile, initialActions, userId }: Props) {
  const supabase = useMemo(() => createClient(), [])

  const [profile,  setProfile]  = useState<RetirementProfile | null>(initialProfile)
  const [actions,  setActions]  = useState<RetirementActionItem[]>(initialActions)
  const [formData, setFormData] = useState<FormData>(() => profileToForm(initialProfile))
  const [saving,   setSaving]   = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved,    setSaved]    = useState(false)

  const [advisorNotes,    setAdvisorNotes]    = useState(initialProfile?.advisor_notes    ?? '')
  const [notesCategory,   setNotesCategory]   = useState(initialProfile?.advisor_notes_category ?? 'general')
  const [advisorSummary,  setAdvisorSummary]  = useState(initialProfile?.advisor_summary  ?? '')
  const [savingNotes,     setSavingNotes]     = useState(false)

  const [newActionLabel,    setNewActionLabel]    = useState('')
  const [newActionCategory, setNewActionCategory] = useState('general')
  const [addingAction,      setAddingAction]      = useState(false)
  const [showFocusDetail,   setShowFocusDetail]   = useState<Record<string, boolean>>({})

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live preview calc from current form values — no save required
  const previewCalc = useMemo(() => {
    const payload = formToProfile(formData)
    const merged: Partial<RetirementProfile> = { ...(profile ?? {}), ...payload } as Partial<RetirementProfile>
    return computeRetirement(merged, client, checklist)
  }, [formData, profile, client, checklist])

  // Saved calc — used for results sections (guarantees data matches what is stored)
  const savedCalc = useMemo(() => computeRetirement(profile, client, checklist), [profile, client, checklist])

  // Planning intelligence — derived from saved profile + checklist
  const intel = useMemo<PlanningIntelligence | null>(() => {
    if (!savedCalc || !profile || !client.age) return null
    const coverageStatus = (item: PlanningChecklist | undefined): boolean | null =>
      item === undefined ? null : (item.is_fulfilled || (item.coverage_pct ?? 0) > 0)
    const lifeItem = checklist.find(c => c.category_name === COVERAGE_KEYS.life)
    const ciItem   = checklist.find(c => c.category_name === COVERAGE_KEYS.ci)
    const tpdItem  = checklist.find(c => c.category_name === COVERAGE_KEYS.tpd)
    const hsItem   = checklist.find(c => c.category_name === COVERAGE_KEYS.hs)
    const ltcItem  = checklist.find(c => c.category_name === COVERAGE_KEYS.ltc)
    return generatePlanningIntelligence({
      gap:                      savedCalc.gap,
      gapMonthly:               savedCalc.gapMonthly,
      projectedAssets:          savedCalc.projectedAssets,
      retirementCorpusNeeded:   savedCalc.retirementCorpusNeeded,
      passiveIncomeMonthly:     savedCalc.passiveIncomeMonthly,
      inflationAdjMonthlyNeeds: savedCalc.inflationAdjMonthlyNeeds,
      yearsToRetire:            savedCalc.yearsToRetire,
      retirementDuration:       savedCalc.retirementDuration,
      readinessScore:           savedCalc.readinessScore,
      status:                   savedCalc.status,
      savingsRate:              savedCalc.savingsRate,
      cpfTotal:                 savedCalc.cpfTotal,
      cpfBrsReached:            savedCalc.cpfBrsReached,
      cpfFrsReached:            savedCalc.cpfFrsReached,
      cpfMaFunded:              savedCalc.cpfMaFunded,
      cpfLifeMonthly:           safeNum(profile.cpf_life_monthly),
      coverageScore:            savedCalc.coverageScore,
      totalAssetsToday:         savedCalc.totalAssetsToday,
      cashBalance:              safeNum(profile.current_savings),
      investmentBalance:        safeNum(profile.investment_portfolio),
      equitiesAlloc:            safeNum(profile.alloc_equities),
      currentAge:               client.age,
      retireAge:                safeNum(profile.target_retirement_age, 65),
      lifeExp:                  safeNum(profile.life_expectancy, 85),
      hasLifeCover:             coverageStatus(lifeItem),
      hasCiCover:               coverageStatus(ciItem),
      hasTpdCover:              coverageStatus(tpdItem),
      hasHsCover:               coverageStatus(hsItem),
      hasLtcCover:              coverageStatus(ltcItem),
    })
  }, [savedCalc, profile, client, checklist])

  // Use preview for snapshot cards; savedCalc for sections that depend on saved data
  const displayCalc = previewCalc

  // ── Field updater ──────────────────────────────────────────────────────────
  const setField = useCallback((key: keyof FormData, v: string) => {
    setFormData(prev => ({ ...prev, [key]: v }))
  }, [])

  // ── Save profile ───────────────────────────────────────────────────────────
  const saveProfile = useCallback(async () => {
    setSaving(true)
    setSaveError(null)

    const payload = formToProfile(formData)
    const merged: Partial<RetirementProfile> = { ...(profile ?? {}), ...payload } as Partial<RetirementProfile>
    const readinessScore = computeRetirement(merged, client, checklist)?.readinessScore ?? null

    const upsertData: InsertRetirementProfile = {
      ...(payload as Omit<InsertRetirementProfile, 'user_id' | 'client_id'>),
      user_id:                userId,
      client_id:              client.id,
      readiness_score:        readinessScore,
      advisor_notes:          advisorNotes || null,
      advisor_notes_category: notesCategory,
      advisor_summary:        advisorSummary || null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data, error } = await db
      .from('client_retirement_profile')
      .upsert(upsertData, { onConflict: 'user_id,client_id' })
      .select()
      .single()

    setSaving(false)
    if (error) {
      setSaveError(error.message ?? 'Save failed')
      return
    }
    setProfile(data as RetirementProfile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }, [formData, profile, client, checklist, userId, advisorNotes, notesCategory, advisorSummary, supabase])

  // ── Debounced notes save ───────────────────────────────────────────────────
  const saveNotes = useCallback(async (notes: string, cat: string, summary: string) => {
    if (!profile) return
    setSavingNotes(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    await db
      .from('client_retirement_profile')
      .update({ advisor_notes: notes || null, advisor_notes_category: cat, advisor_summary: summary || null })
      .eq('id', profile.id)
      .eq('user_id', userId)
    setSavingNotes(false)
  }, [profile, userId, supabase])

  const debounceSaveNotes = useCallback((notes: string, cat: string, summary: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => saveNotes(notes, cat, summary), 800)
  }, [saveNotes])

  // ── Toggle action ──────────────────────────────────────────────────────────
  const toggleAction = useCallback(async (item: RetirementActionItem) => {
    const updated = { ...item, is_completed: !item.is_completed }
    setActions(prev => prev.map(a => a.id === item.id ? updated : a))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { error } = await db
      .from('client_retirement_action_items')
      .update({ is_completed: updated.is_completed })
      .eq('id', item.id)
      .eq('user_id', userId)
    if (error) setActions(prev => prev.map(a => a.id === item.id ? item : a))
  }, [userId, supabase])

  // ── Delete action ──────────────────────────────────────────────────────────
  const deleteAction = useCallback(async (id: string) => {
    setActions(prev => prev.filter(a => a.id !== id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    await db.from('client_retirement_action_items').delete().eq('id', id).eq('user_id', userId)
  }, [userId, supabase])

  // ── Generate action plan (avoids duplicates by clearing non-custom first) ─
  const generateActionPlan = useCallback(async () => {
    if (!displayCalc) return
    setSaving(true)

    const autoItems = buildAutoActions(displayCalc)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    // Remove existing non-custom items first to prevent duplicates
    const existingAutoIds = actions.filter(a => !a.is_custom).map(a => a.id)
    if (existingAutoIds.length > 0) {
      await db.from('client_retirement_action_items').delete().in('id', existingAutoIds).eq('user_id', userId)
    }

    const insertItems = autoItems.map(item => ({ ...item, user_id: userId, client_id: client.id }))
    const { data, error } = await db.from('client_retirement_action_items').insert(insertItems).select()
    setSaving(false)

    if (!error && data) {
      setActions(prev => [...prev.filter(a => a.is_custom), ...(data as RetirementActionItem[])])
    }
  }, [displayCalc, actions, userId, client.id, supabase])

  // ── Add custom action ──────────────────────────────────────────────────────
  const addAction = useCallback(async () => {
    if (!newActionLabel.trim()) return
    setAddingAction(true)
    const maxOrder = actions.reduce((m, a) => Math.max(m, a.sort_order), 0)
    const item: InsertRetirementActionItem = {
      user_id:      userId,
      client_id:    client.id,
      label:        newActionLabel.trim(),
      category:     newActionCategory,
      is_completed: false,
      is_custom:    true,
      sort_order:   maxOrder + 1,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data, error } = await db.from('client_retirement_action_items').insert(item).select().single()
    setAddingAction(false)
    if (!error && data) {
      setActions(prev => [...prev, data as RetirementActionItem])
      setNewActionLabel('')
    }
  }, [newActionLabel, newActionCategory, actions, userId, client.id, supabase])

  // ── Allocation slices ──────────────────────────────────────────────────────
  const allocSlices = [
    { key: 'equities', label: 'Equities',  pct: parseInt(formData.alloc_equities  || '0', 10) || 0 },
    { key: 'bonds',    label: 'Bonds',     pct: parseInt(formData.alloc_bonds     || '0', 10) || 0 },
    { key: 'cash',     label: 'Cash',      pct: parseInt(formData.alloc_cash      || '0', 10) || 0 },
    { key: 'property', label: 'Property',  pct: parseInt(formData.alloc_property  || '0', 10) || 0 },
    { key: 'cpf',      label: 'CPF',       pct: parseInt(formData.alloc_cpf       || '0', 10) || 0 },
    { key: 'others',   label: 'Others',    pct: parseInt(formData.alloc_others    || '0', 10) || 0 },
  ]
  const allocTotal = allocSlices.reduce((s, a) => s + a.pct, 0)

  // ── Protection items from checklist ───────────────────────────────────────
  const protectionItems = [
    { key: COVERAGE_KEYS.life, label: 'Life' },
    { key: COVERAGE_KEYS.tpd,  label: 'TPD' },
    { key: COVERAGE_KEYS.ci,   label: 'Critical Illness' },
    { key: COVERAGE_KEYS.add,  label: 'Accidental D&D' },
    { key: COVERAGE_KEYS.ltc,  label: 'Long-Term Care' },
    { key: COVERAGE_KEYS.hs,   label: 'Hospital & Surgical' },
    { key: COVERAGE_KEYS.si,   label: 'Savings & Investments' },
  ].map(({ key, label }) => ({ label, item: checklist.find(c => c.category_name === key) }))

  const priorityConfig = {
    critical:    { label: 'Critical',     bg: 'bg-red-50 border-red-200',       text: 'text-red-700',    dot: 'bg-red-500' },
    important:   { label: 'Important',    bg: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',  dot: 'bg-amber-500' },
    recommended: { label: 'Recommended',  bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  }

  const hasResults = profile !== null && savedCalc !== null

  return (
    <div className="space-y-4">

      {/* ── Saved status banner ─── */}
      {hasResults && displayCalc && (
        <StatusBanner status={displayCalc.status} score={displayCalc.readinessScore} />
      )}

      {/* ── Validation errors ────── */}
      {displayCalc && displayCalc.validationErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-1">
          {displayCalc.validationErrors.map(e => (
            <p key={e.field} className="text-sm text-red-700 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {e.message}
            </p>
          ))}
        </div>
      )}

      {/* ══ INPUT FORM ══════════════════════════════════════════════════════ */}
      <SectionCard title="Retirement Inputs" icon={PenLine}>
        <FieldGroup label="Basic Info">
          <NumberInput label="Target Retirement Age" value={formData.target_retirement_age} onChange={v => setField('target_retirement_age', v)} suffix="yrs"
            error={!!displayCalc?.validationErrors.find(e => e.field === 'target_retirement_age')} />
          <NumberInput label="Life Expectancy"       value={formData.life_expectancy}        onChange={v => setField('life_expectancy', v)}        suffix="yrs"
            error={!!displayCalc?.validationErrors.find(e => e.field === 'life_expectancy')} />
          <NumberInput label="Current Monthly Income"   value={formData.current_monthly_income}    onChange={v => setField('current_monthly_income', v)}   prefix="$" hint="Used for savings rate" />
          <NumberInput label="Current Monthly Expenses" value={formData.current_monthly_expenses}  onChange={v => setField('current_monthly_expenses', v)} prefix="$" />
          <NumberInput label="Monthly Needs in Retirement" value={formData.retirement_monthly_needs} onChange={v => setField('retirement_monthly_needs', v)} prefix="$" hint="Today's dollars" />
        </FieldGroup>

        <FieldGroup label="Assumptions">
          <NumberInput label="Inflation Rate"               value={formData.inflation_rate}               onChange={v => setField('inflation_rate', v)}               suffix="%" hint="Default 3%" />
          <NumberInput label="Pre-retirement Return"        value={formData.expected_return_rate}          onChange={v => setField('expected_return_rate', v)}          suffix="%" hint="Default 5%" />
          <NumberInput label="Post-retirement Return"       value={formData.post_retirement_return_rate}   onChange={v => setField('post_retirement_return_rate', v)}   suffix="%" hint="Default 3.5%" />
        </FieldGroup>

        <FieldGroup label="Current Assets">
          <NumberInput label="Cash / Savings"       value={formData.current_savings}                onChange={v => setField('current_savings', v)}                prefix="$" />
          <NumberInput label="CPF Ordinary Account" value={formData.cpf_ordinary_account}           onChange={v => setField('cpf_ordinary_account', v)}           prefix="$" />
          <NumberInput label="CPF Special Account"  value={formData.cpf_special_account}            onChange={v => setField('cpf_special_account', v)}            prefix="$" />
          <NumberInput label="CPF MediSave"         value={formData.cpf_medisave_account}           onChange={v => setField('cpf_medisave_account', v)}           prefix="$" />
          <NumberInput label="Investment Portfolio"  value={formData.investment_portfolio}           onChange={v => setField('investment_portfolio', v)}           prefix="$" hint="Unit trusts, stocks, ETFs, ILP, SRS, endowments" />
          <NumberInput label="Fixed Deposits / Other" value={formData.other_assets}                 onChange={v => setField('other_assets', v)}                   prefix="$" />
          <NumberInput label="Property Value"       value={formData.property_value}                 onChange={v => setField('property_value', v)}                 prefix="$" />
          <NumberInput label="Mortgage Outstanding" value={formData.property_mortgage_outstanding}  onChange={v => setField('property_mortgage_outstanding', v)}  prefix="$" />
        </FieldGroup>

        <FieldGroup label="Retirement Income Sources (Monthly)">
          <NumberInput label="CPF LIFE Payout"       value={formData.cpf_life_monthly}          onChange={v => setField('cpf_life_monthly', v)}          prefix="$" />
          <NumberInput label="Rental Income"         value={formData.rental_income_monthly}     onChange={v => setField('rental_income_monthly', v)}     prefix="$" />
          <NumberInput label="Dividends / Other"     value={formData.other_income_monthly}      onChange={v => setField('other_income_monthly', v)}      prefix="$" />
          <NumberInput label="Part-time Income"      value={formData.part_time_income_monthly}  onChange={v => setField('part_time_income_monthly', v)}  prefix="$" />
        </FieldGroup>

        <FieldGroup label="Monthly Contributions">
          <NumberInput label="Cash Savings"    value={formData.monthly_savings_contribution}    onChange={v => setField('monthly_savings_contribution', v)}    prefix="$" />
          <NumberInput label="CPF (Employee)"  value={formData.monthly_cpf_employee}            onChange={v => setField('monthly_cpf_employee', v)}            prefix="$" />
          <NumberInput label="CPF (Employer)"  value={formData.monthly_cpf_employer}            onChange={v => setField('monthly_cpf_employer', v)}            prefix="$" />
          <NumberInput label="Investments"     value={formData.monthly_investment_contribution} onChange={v => setField('monthly_investment_contribution', v)} prefix="$" />
        </FieldGroup>

        <FieldGroup label="Asset Allocation (%)">
          <NumberInput label="Equities"  value={formData.alloc_equities}  onChange={v => setField('alloc_equities', v)}  suffix="%" />
          <NumberInput label="Bonds"     value={formData.alloc_bonds}     onChange={v => setField('alloc_bonds', v)}     suffix="%" />
          <NumberInput label="Cash"      value={formData.alloc_cash}      onChange={v => setField('alloc_cash', v)}      suffix="%" />
          <NumberInput label="Property"  value={formData.alloc_property}  onChange={v => setField('alloc_property', v)}  suffix="%" />
          <NumberInput label="CPF"       value={formData.alloc_cpf}       onChange={v => setField('alloc_cpf', v)}       suffix="%" />
          <NumberInput label="Others"    value={formData.alloc_others}    onChange={v => setField('alloc_others', v)}    suffix="%" />
        </FieldGroup>
        {allocTotal > 0 && allocTotal !== 100 && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            Allocation totals {allocTotal}% — should sum to 100%
          </p>
        )}

        {/* Live preview strip */}
        {displayCalc && displayCalc.validationErrors.length === 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-center">
              <p className="text-xs text-slate-400">Projected</p>
              <p className="text-sm font-bold text-indigo-600 tabular-nums">{formatCurrency(displayCalc.projectedAssets)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">Corpus Required</p>
              <p className="text-sm font-bold text-slate-700 tabular-nums">{formatCurrency(displayCalc.retirementCorpusNeeded)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400">{displayCalc.gap > 0 ? 'Shortfall' : 'Surplus'}</p>
              <p className={cn('text-sm font-bold tabular-nums', displayCalc.gap > 0 ? 'text-red-600' : 'text-emerald-600')}>
                {formatCurrency(Math.abs(displayCalc.gap))}
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : null}
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save Report'}
          </button>
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        </div>
      </SectionCard>

      {/* No profile yet */}
      {!hasResults && (
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-8 text-center">
          <BarChart3 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Fill in the inputs above and save to generate the full retirement analysis.</p>
        </div>
      )}

      {hasResults && savedCalc && (
        <>
          {/* ══ RETIREMENT SNAPSHOT ════════════════════════════════════════════ */}
          <SectionCard title="Retirement Snapshot" icon={BarChart3}>
            <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-4">
              <MetricCard label="Years to Retirement" value={`${savedCalc.yearsToRetire} yrs`}        sub={`Retire at ${profile!.target_retirement_age ?? '—'}`}  accent="indigo" />
              <MetricCard label="Retirement Duration"  value={`${savedCalc.retirementDuration} yrs`}  sub={`Until age ${profile!.life_expectancy ?? 85}`}          accent="slate" />
              <MetricCard label="Monthly Needs (today)" value={formatCurrency(safeNum(profile!.retirement_monthly_needs))} sub="Before inflation"              accent="slate" />
              <MetricCard label="Monthly Needs (at retirement)" value={formatCurrency(savedCalc.inflationAdjMonthlyNeeds)} sub="Inflation-adjusted"         accent="slate" />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row gap-6 items-start">
              <div className="flex flex-col items-center shrink-0">
                <p className="text-xs text-slate-500 mb-1">Readiness Score</p>
                <ReadinessGauge score={savedCalc.readinessScore} />
                <p className="text-xs text-slate-400 text-center max-w-[9rem] leading-tight mt-1">
                  {savedCalc.status === 'on_track' ? 'Well positioned' :
                   savedCalc.status === 'slightly_behind' ? 'Minor adjustments needed' :
                   savedCalc.status === 'moderate_shortfall' ? 'Significant action required' :
                   'Urgent attention required'}
                </p>
              </div>
              <div className="flex-1 w-full space-y-4">
                <GapBar projected={savedCalc.projectedAssets} needed={savedCalc.retirementCorpusNeeded} />
                <div className="grid grid-cols-2 gap-2">
                  <MetricCard
                    label="Projected Assets at Retirement"
                    value={formatCurrency(savedCalc.projectedAssets)}
                    accent={savedCalc.gap <= 0 ? 'emerald' : 'indigo'}
                  />
                  <MetricCard
                    label={savedCalc.gap > 0 ? 'Funding Shortfall' : 'Funding Surplus'}
                    value={formatCurrency(Math.abs(savedCalc.gap))}
                    sub={savedCalc.gap > 0 ? `+${formatCurrency(savedCalc.gapMonthly)}/mo needed` : 'Fully funded'}
                    accent={savedCalc.gap > 0 ? 'red' : 'emerald'}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ══ GAP ANALYSIS ════════════════════════════════════════════════════ */}
          <SectionCard title="Retirement Gap Analysis" icon={TrendingUp}>
            <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-3">
              <MetricCard label="Total Assets Today (excl. property)"  value={formatCurrency(savedCalc.totalAssetsToday)}           accent="slate" />
              <MetricCard label="Projected at Retirement"              value={formatCurrency(savedCalc.projectedAssets)}            accent="indigo" />
              <MetricCard label="Passive Income (PV at retirement)"    value={formatCurrency(savedCalc.passiveIncomePV)}            accent="emerald" />
              <MetricCard label="Corpus Required (net of passive)"     value={formatCurrency(savedCalc.retirementCorpusNeeded)}     accent="slate" />
              <MetricCard
                label={savedCalc.gap > 0 ? 'Funding Shortfall' : 'Funding Surplus'}
                value={formatCurrency(Math.abs(savedCalc.gap))}
                sub={savedCalc.gap > 0 ? `Close by adding ${formatCurrency(savedCalc.gapMonthly)}/mo` : undefined}
                accent={savedCalc.gap > 0 ? 'red' : 'emerald'}
              />
              <MetricCard
                label="Savings Rate (estimated)"
                value={`${(savedCalc.savingsRate * 100).toFixed(1)}%`}
                sub="Target ≥ 15–20%"
                accent={savedCalc.savingsRate >= 0.15 ? 'emerald' : 'amber'}
              />
            </div>
            <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-100 space-y-1.5">
              <p className="text-xs text-slate-600 font-medium">Methodology</p>
              <p className="text-xs text-slate-500">
                Existing assets projected at <strong>{((profile!.expected_return_rate ?? 0.05) * 100).toFixed(1)}% p.a.</strong> (pre-retirement).
                Corpus required = PV of monthly needs over {savedCalc.retirementDuration} yrs at <strong>{((profile!.post_retirement_return_rate ?? 0.035) * 100).toFixed(1)}% p.a.</strong> (post-retirement), inflated at {((profile!.inflation_rate ?? 0.03) * 100).toFixed(1)}% p.a.
                Passive income PV is deducted from corpus requirement.
              </p>
              <p className="text-xs text-amber-600 flex items-start gap-1 mt-1">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Projections are illustrative. Actual outcomes depend on market performance, CPF policy changes, and life events.
              </p>
            </div>
          </SectionCard>

          {/* ══ CPF ANALYSIS ════════════════════════════════════════════════════ */}
          <SectionCard title="CPF & Income Floor Analysis" icon={ShieldCheck}>
            <div className="grid grid-cols-2 gap-3 mt-4 sm:grid-cols-4">
              <MetricCard label="CPF OA"            value={formatCurrency(safeNum(profile!.cpf_ordinary_account))} accent="indigo" />
              <MetricCard label="CPF SA"            value={formatCurrency(safeNum(profile!.cpf_special_account))}  accent="indigo" />
              <MetricCard label="MediSave"          value={formatCurrency(safeNum(profile!.cpf_medisave_account))} accent={savedCalc.cpfMaFunded ? 'emerald' : 'amber'} />
              <MetricCard label="CPF LIFE (est.)"   value={formatCurrency(safeNum(profile!.cpf_life_monthly)) + '/mo'} accent="indigo" />
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                { label: 'Basic Retirement Sum (BRS) $99,400',      met: savedCalc.cpfBrsReached },
                { label: 'Full Retirement Sum (FRS) $198,800',      met: savedCalc.cpfFrsReached },
                { label: 'Basic Healthcare Sum (BHS) $66,000',      met: savedCalc.cpfMaFunded },
                { label: 'CPF LIFE ≥ $1,300/mo (BRS income floor)', met: safeNum(profile!.cpf_life_monthly) >= 1300 },
                { label: 'CPF LIFE ≥ $2,000/mo (FRS income floor)', met: safeNum(profile!.cpf_life_monthly) >= 2000 },
              ].map(({ label, met }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-white text-xs shrink-0', met ? 'bg-emerald-500' : 'bg-slate-200')}>
                    {met && <Check className="h-3 w-3" />}
                  </span>
                  <span className={cn('text-sm', met ? 'text-slate-700' : 'text-slate-400')}>{label}</span>
                  {!met && <span className="ml-auto text-xs text-amber-600">Action needed</span>}
                </div>
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">Passive Income at Retirement</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { label: 'CPF LIFE',    val: profile!.cpf_life_monthly },
                  { label: 'Rental',      val: profile!.rental_income_monthly },
                  { label: 'Dividends',   val: profile!.other_income_monthly },
                  { label: 'Part-time',   val: profile!.part_time_income_monthly },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-slate-500">{label}</span>
                    <span className="font-medium text-slate-700 tabular-nums">{formatCurrency(safeNum(val))}/mo</span>
                  </div>
                ))}
                <div className="flex justify-between col-span-2 pt-1 border-t border-slate-100 font-semibold">
                  <span className="text-slate-600">Total Passive Income</span>
                  <span className="text-emerald-600 tabular-nums">{formatCurrency(savedCalc.passiveIncomeMonthly)}/mo</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ══ ASSET ALLOCATION ════════════════════════════════════════════════ */}
          <SectionCard title="Asset Allocation" icon={BarChart3}>
            <div className="mt-4">
              <AllocationDonut slices={allocSlices} />
              {allocTotal > 0 && allocTotal !== 100 && (
                <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Total allocation is {allocTotal}% — update inputs to sum to 100% for an accurate chart.
                </p>
              )}
            </div>
          </SectionCard>

          {/* ══ PROTECTION RISK ════════════════════════════════════════════════ */}
          <SectionCard title="Protection Risk Before Retirement" icon={ShieldCheck}>
            <p className="text-xs text-slate-500 mt-3 mb-4">
              Coverage status is pulled from the client&apos;s <strong>Coverage</strong> tab.
              {checklist.length === 0 && ' No coverage data has been entered yet — open the Coverage tab to add details.'}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {protectionItems.map(({ label, item }) => {
                const covered = item ? (item.is_fulfilled || (item.coverage_pct ?? 0) >= 100) : false
                const partial  = item ? (!item.is_fulfilled && (item.coverage_pct ?? 0) > 0) : false
                const unknown  = !item
                return (
                  <div key={label} className={cn(
                    'rounded-lg border p-3 flex flex-col items-center gap-1.5',
                    covered ? 'bg-emerald-50 border-emerald-200' :
                    partial  ? 'bg-amber-50 border-amber-200' :
                    unknown  ? 'bg-slate-50 border-slate-200' :
                               'bg-red-50 border-red-200'
                  )}>
                    <span className={cn('text-xs font-semibold text-center leading-tight',
                      covered ? 'text-emerald-700' : partial ? 'text-amber-700' : unknown ? 'text-slate-400' : 'text-red-600'
                    )}>{label}</span>
                    <span className={cn('text-xs',
                      covered ? 'text-emerald-600' : partial ? 'text-amber-600' : unknown ? 'text-slate-400' : 'text-red-500'
                    )}>
                      {covered ? 'Covered' : partial ? `${item!.coverage_pct ?? 0}%` : unknown ? 'Unknown' : 'Missing'}
                    </span>
                  </div>
                )
              })}
            </div>
            {checklist.length === 0 && (
              <p className="text-xs text-slate-400 mt-3 italic">
                Coverage data is not yet available. Open the Coverage tab to enter protection details and this section will update automatically.
              </p>
            )}
          </SectionCard>

          {/* ══ PLANNING INTELLIGENCE DIVIDER ══════════════════════════════════ */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 px-1">Planning Intelligence</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>

          {/* ══ TOP 3 FOCUS AREAS ══════════════════════════════════════════════ */}
          <SectionCard title="Top 3 Planning Focus Areas" icon={Target}>
            <div className="space-y-3 mt-4">
              {(intel?.topThree ?? []).length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">Retirement plan is well-structured. Review annually and consider estate planning.</p>
                </div>
              ) : (intel?.topThree ?? []).map((area, i) => {
                const pc     = priorityConfig[area.severity]
                const isOpen = showFocusDetail[area.key] ?? false
                const tierLabel = ['Protection', 'Gap & Income', 'Accumulation', 'Advanced'][area.tier - 1]
                return (
                  <div key={area.key} className={cn('rounded-xl border p-4', pc.bg)}>
                    <div className="flex items-start gap-3">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center text-xs font-bold text-slate-600">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className={cn('text-sm font-semibold', pc.text)}>{area.title}</h4>
                          <span className={cn('text-xs px-1.5 py-0.5 rounded font-medium border', pc.bg, pc.text)}>{pc.label}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-white/60 text-slate-500 border border-slate-200">{tierLabel}</span>
                        </div>
                        <p className={cn('text-xs mt-1 leading-relaxed', pc.text)}>{area.reason}</p>
                        <button
                          type="button"
                          onClick={() => setShowFocusDetail(prev => ({ ...prev, [area.key]: !isOpen }))}
                          className={cn('text-xs font-medium mt-2 flex items-center gap-1', pc.text)}
                        >
                          {isOpen ? 'Hide' : 'Show'} Planning Direction
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                        {isOpen && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-0.5">What this means</p>
                              <p className="text-xs text-slate-600 leading-relaxed">{area.meaning}</p>
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-slate-500">Conversation Prompts</p>
                              {([
                                { label: 'Soft Opening',       content: area.prompts.softOpen },
                                { label: 'Discovery Question', content: area.prompts.discovery },
                                { label: 'Reframe',            content: area.prompts.reframe },
                                { label: 'Closing',            content: area.prompts.closing },
                              ] as const).map(p => (
                                <div key={p.label} className="bg-white/60 rounded-lg px-3 py-2.5">
                                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">{p.label}</p>
                                  <p className="text-xs text-slate-600 italic leading-relaxed">&ldquo;{p.content}&rdquo;</p>
                                </div>
                              ))}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1">Suggested next steps</p>
                              <ul className="space-y-1">
                                {area.steps.map((step, j) => (
                                  <li key={j} className="flex items-start gap-1.5 text-xs text-slate-600">
                                    <span className={cn('mt-1 h-1.5 w-1.5 rounded-full shrink-0', pc.dot)} />
                                    {step}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>

          {/* ══ ADVISOR INTELLIGENCE SUMMARY ═══════════════════════════════════ */}
          {intel && (
            <SectionCard title="Advisor Intelligence Summary" icon={Lightbulb}>
              <div className="mt-4 space-y-3">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Overall View</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{intel.advisorIntelligence.overallView}</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                  <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-widest mb-1.5">Main Planning Concern</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{intel.advisorIntelligence.mainConcern}</p>
                </div>
                <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-100">
                  <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-widest mb-1.5">Why This Matters</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{intel.advisorIntelligence.whyItMatters}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">What To Clarify With Client</p>
                  <ul className="space-y-2">
                    {intel.advisorIntelligence.clarifyWithClient.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-4 rounded-lg bg-violet-50 border border-violet-100">
                  <p className="text-[10px] font-semibold text-violet-500 uppercase tracking-widest mb-1.5">Recommended Conversation Direction</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{intel.advisorIntelligence.conversationDirection}</p>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                  <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1.5">Suggested Next Step</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{intel.advisorIntelligence.suggestedNextStep}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ══ PLANNING CATEGORY RECOMMENDATION ══════════════════════════════ */}
          {intel && (
            <SectionCard title="Recommended Planning Focus" icon={Target} defaultOpen={false}>
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold">{intel.planningCategory.category}</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{intel.planningCategory.why}</p>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Suggested Meeting Agenda</p>
                  <ol className="space-y-2">
                    {intel.planningCategory.agenda.map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                        <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ══ WHAT NOT TO RUSH ═══════════════════════════════════════════════ */}
          {intel && intel.whatNotToRush.length > 0 && (
            <SectionCard title="What Not To Rush Into Yet" icon={AlertTriangle} defaultOpen={false}>
              <div className="mt-4 space-y-2.5">
                {intel.whatNotToRush.map((item, i) => (
                  <div key={i} className="p-3.5 rounded-lg border border-amber-200 bg-amber-50">
                    <p className="text-xs font-semibold text-amber-800 mb-1">{item.warning}</p>
                    <p className="text-xs text-amber-700 leading-relaxed">{item.reason}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* ══ NEXT APPOINTMENT PREP ══════════════════════════════════════════ */}
          {intel && (
            <SectionCard title="Next Appointment Prep" icon={Calendar} defaultOpen={false}>
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Key Points to Cover</p>
                  <ol className="space-y-1.5">
                    {intel.appointmentPrep.keyPoints.map((pt, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        {pt}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-2">Opening Questions</p>
                  <ol className="space-y-2">
                    {intel.appointmentPrep.questions.map((q, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                        <span className="shrink-0 mt-0.5 h-4 w-4 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                        <span className="italic">&ldquo;{q}&rdquo;</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-100">
                    <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-widest mb-1">Likely Objection</p>
                    <p className="text-xs text-slate-700 italic">{intel.appointmentPrep.objection}</p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-100">
                    <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-widest mb-1">Suggested Response</p>
                    <p className="text-xs text-slate-700 leading-relaxed">{intel.appointmentPrep.response}</p>
                  </div>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Follow-up Action</p>
                  <p className="text-xs text-slate-700">{intel.appointmentPrep.followUp}</p>
                </div>
              </div>
            </SectionCard>
          )}

          {/* ══ ADVISOR SUMMARY ════════════════════════════════════════════════ */}
          <SectionCard title="Advisor Planning Summary" icon={BookOpen}>
            <div className="mt-4">
              <label className="block text-xs text-slate-500 mb-1.5">Planning Summary (client-facing)</label>
              <textarea
                rows={4}
                value={advisorSummary}
                onChange={e => {
                  setAdvisorSummary(e.target.value)
                  debounceSaveNotes(advisorNotes, notesCategory, e.target.value)
                }}
                placeholder="e.g. Based on current savings and CPF projections, your retirement plan shows…"
                className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none placeholder:text-slate-300"
              />
              <p className="text-xs text-slate-400 mt-1.5 flex items-start gap-1">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                Use professional, measured language. Avoid guaranteeing outcomes. Refer to the assumptions used in the projection.
              </p>
            </div>
          </SectionCard>

          {/* ══ ADVISOR NOTES ══════════════════════════════════════════════════ */}
          <SectionCard title="Advisor Notes" icon={PenLine} defaultOpen={false}>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Category</label>
                <select
                  value={notesCategory}
                  onChange={e => { setNotesCategory(e.target.value); debounceSaveNotes(advisorNotes, e.target.value, advisorSummary) }}
                  className="text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-700"
                >
                  {NOTES_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Notes (internal — not shared with client)</label>
                <textarea
                  rows={5}
                  value={advisorNotes}
                  onChange={e => { setAdvisorNotes(e.target.value); debounceSaveNotes(e.target.value, notesCategory, advisorSummary) }}
                  placeholder="Risk appetite observations, client concerns, follow-up reminders…"
                  className="w-full text-sm text-slate-700 border border-slate-200 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 resize-none placeholder:text-slate-300"
                />
              </div>
              {savingNotes && (
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />Saving…
                </p>
              )}
            </div>
          </SectionCard>

          {/* ══ ACTION PLAN ════════════════════════════════════════════════════ */}
          <SectionCard title="Action Plan Checklist" icon={ClipboardCheck}>
            <div className="mt-4 space-y-2">
              {actions.length === 0 ? (
                <div className="text-center py-6">
                  <ClipboardCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-400 mb-3">No action items yet.</p>
                  <button
                    type="button"
                    onClick={generateActionPlan}
                    disabled={saving}
                    className="flex items-center gap-2 mx-auto px-4 py-2 border border-indigo-300 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Generate from Analysis
                  </button>
                </div>
              ) : actions.map(action => {
                const catLabel = ACTION_CATEGORIES.find(c => c.value === action.category)?.label ?? action.category
                return (
                  <div key={action.id} className={cn(
                    'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                    action.is_completed ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white border-slate-100'
                  )}>
                    <button
                      type="button"
                      onClick={() => toggleAction(action)}
                      className={cn(
                        'shrink-0 mt-0.5 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors',
                        action.is_completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 hover:border-indigo-400'
                      )}
                    >
                      {action.is_completed && <Check className="h-3 w-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-sm', action.is_completed ? 'line-through text-slate-400' : 'text-slate-700')}>{action.label}</p>
                      <span className="text-xs text-slate-400">{catLabel}{action.is_custom ? ' · Custom' : ''}</span>
                    </div>
                    <button type="button" onClick={() => deleteAction(action.id)} className="shrink-0 p-1 text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>

            {actions.length > 0 && (
              <div className="mt-2 flex justify-between items-center">
                <p className="text-xs text-slate-400">{actions.filter(a => a.is_completed).length} of {actions.length} completed</p>
                <button
                  type="button"
                  onClick={generateActionPlan}
                  disabled={saving}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Regenerate (replaces auto items)
                </button>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-500 mb-2">Add Custom Action</p>
              <div className="flex gap-2">
                <select
                  value={newActionCategory}
                  onChange={e => setNewActionCategory(e.target.value)}
                  className="text-xs border border-slate-200 rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white text-slate-600 shrink-0"
                >
                  {ACTION_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <input
                  type="text"
                  value={newActionLabel}
                  onChange={e => setNewActionLabel(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addAction()}
                  placeholder="Action item description…"
                  className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 placeholder:text-slate-300"
                />
                <button
                  type="button"
                  onClick={addAction}
                  disabled={addingAction || !newActionLabel.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {addingAction ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Add
                </button>
              </div>
            </div>
          </SectionCard>

          {/* ══ DISCLAIMER ═════════════════════════════════════════════════════ */}
          <div className="rounded-xl border border-slate-200/40 bg-slate-50/60 px-5 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1.5">Disclaimer</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              This retirement report is for planning and discussion purposes only. All projections are based on stated assumptions and do not constitute financial advice.
              Actual investment returns, CPF policies, and personal circumstances may differ materially from the assumptions used.
              This report does not account for taxes, estate duties, or other deductions. Clients should seek independent financial advice before making any decisions.
              Information presented here is confidential and intended solely for the named client.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
