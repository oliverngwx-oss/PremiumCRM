// Advisor planning intelligence layer for the Retirement Report.
// Generates structured planning output from the computed retirement data.
// This module contains no React — pure functions only.

import { formatCurrency } from '@/lib/utils'

// ─── Input shape ──────────────────────────────────────────────────────────────

export interface IntelligenceInput {
  // computed numbers
  gap:                    number
  gapMonthly:             number
  projectedAssets:        number
  retirementCorpusNeeded: number
  passiveIncomeMonthly:   number
  inflationAdjMonthlyNeeds: number
  yearsToRetire:          number
  retirementDuration:     number
  readinessScore:         number
  status:                 'on_track' | 'slightly_behind' | 'moderate_shortfall' | 'high_risk'
  savingsRate:            number
  cpfTotal:               number
  cpfBrsReached:          boolean
  cpfFrsReached:          boolean
  cpfMaFunded:            boolean
  cpfLifeMonthly:         number
  coverageScore:          number
  totalAssetsToday:       number
  cashBalance:            number
  investmentBalance:      number
  equitiesAlloc:          number
  // client context
  currentAge:             number
  retireAge:              number
  lifeExp:                number
  // checklist status per category (null = no data)
  hasLifeCover:           boolean | null
  hasCiCover:             boolean | null
  hasTpdCover:            boolean | null
  hasHsCover:             boolean | null
  hasLtcCover:            boolean | null
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface ConversationPrompts {
  softOpen:  string
  discovery: string
  reframe:   string
  closing:   string
}

export interface FocusAreaIntel {
  key:      string
  title:    string
  tier:     1 | 2 | 3 | 4  // 1=Protection, 2=Gap, 3=Accumulation, 4=Advanced
  severity: 'critical' | 'important' | 'recommended'
  reason:   string
  meaning:  string
  steps:    string[]
  prompts:  ConversationPrompts
}

export interface PlanningCategoryRec {
  category: string
  why:      string
  agenda:   [string, string, string]
}

export interface WhatNotToRush {
  warning: string
  reason:  string
}

export interface AppointmentPrep {
  keyPoints: [string, string, string]
  questions: [string, string, string]
  objection: string
  response:  string
  followUp:  string
}

export interface AdvisorIntelligence {
  overallView:           string
  mainConcern:           string
  whyItMatters:          string
  clarifyWithClient:     [string, string, string]
  conversationDirection: string
  suggestedNextStep:     string
}

export interface PlanningIntelligence {
  focusAreas:          FocusAreaIntel[]    // all generated areas, sorted by priority
  topThree:            FocusAreaIntel[]    // slice(0, 3)
  planningCategory:    PlanningCategoryRec
  whatNotToRush:       WhatNotToRush[]
  appointmentPrep:     AppointmentPrep
  advisorIntelligence: AdvisorIntelligence
}

// ─── Tier scoring ─────────────────────────────────────────────────────────────
// Higher score = surface first. Tier base + severity modifier + urgency bonus.

function tierScore(tier: 1 | 2 | 3 | 4, severity: 'critical' | 'important' | 'recommended', urgency = 0): number {
  const base     = [1000, 600, 300, 100][tier - 1]
  const sevMod   = { critical: 40, important: 20, recommended: 5 }[severity]
  return base + sevMod + urgency
}

// ─── Focus area generation ────────────────────────────────────────────────────

function generateFocusAreas(inp: IntelligenceInput): FocusAreaIntel[] {
  const areas: FocusAreaIntel[] = []
  const {
    gap, gapMonthly, projectedAssets, retirementCorpusNeeded,
    passiveIncomeMonthly, inflationAdjMonthlyNeeds, yearsToRetire, retirementDuration,
    savingsRate, cpfTotal, cpfBrsReached, cpfFrsReached, cpfMaFunded, cpfLifeMonthly,
    coverageScore, totalAssetsToday, cashBalance, investmentBalance, equitiesAlloc,
    currentAge, retireAge, lifeExp,
    hasLifeCover, hasCiCover, hasTpdCover, hasHsCover, hasLtcCover,
    readinessScore,
  } = inp

  // ── Tier 1: Risks that can derail retirement before retirement ──────────────

  // Life / TPD / CI coverage unknown or missing
  const protectionUnknown = hasLifeCover === null && hasCiCover === null && hasTpdCover === null
  const protectionMissing = hasLifeCover === false || hasCiCover === false || hasTpdCover === false
  if (protectionUnknown || protectionMissing || coverageScore < 10) {
    const sev: FocusAreaIntel['severity'] = coverageScore === 0 ? 'critical' : 'important'
    areas.push({
      key:      'protection',
      title:    'Protection Coverage',
      tier:     1,
      severity: sev,
      reason:   protectionUnknown
        ? 'Based on the information available, there is no recorded data on existing protection coverage. This makes it difficult to assess the client\'s financial resilience before retirement.'
        : `One or more key coverage categories — Life, Critical Illness, or TPD — may be missing or undercovered. This could indicate a meaningful gap in the client\'s pre-retirement safety net.`,
      meaning:  'A major illness, disability, or premature death before retirement can significantly disrupt the retirement trajectory. Without adequate coverage, savings intended for retirement may be redirected to cover medical costs, income loss, or debt repayment.',
      steps: [
        'Obtain a complete picture of existing life, CI, and TPD coverage with sum assured amounts',
        'Review whether sum assured is still appropriate relative to current income and liabilities',
        'Confirm MediShield Life and Integrated Shield Plan (IP) status',
      ],
      prompts: {
        softOpen:  'Before we go deeper into the retirement numbers, I\'d like to revisit protection. If something happened to you before retirement — a serious illness, or an accident — how confident are you that your family would be financially stable while you recover?',
        discovery: 'If you were hospitalised for three months and unable to work, what would be the first financial pressure you and your family would face? And how long could your current savings absorb that?',
        reframe:   'Retirement planning works best on a solid protection base. A major illness before retirement can undo years of careful saving very quickly — often faster than the recovery itself. Based on what we\'ve reviewed, it may be worth confirming that foundation is in place.',
        closing:   'Would it be helpful to do a structured coverage review so we have a clear picture of what is protected and what may need attention — before we finalise the longer-term retirement strategy?',
      },
    })
  }

  // Hospital and Surgical gap
  if (hasHsCover === false || (hasHsCover === null && coverageScore === 0)) {
    areas.push({
      key:      'hospital',
      title:    'Hospital & Surgical Coverage',
      tier:     1,
      severity: hasHsCover === false ? 'important' : 'recommended',
      reason:   'Hospital and surgical coverage data is not recorded. Integrated Shield Plan status is unknown.',
      meaning:  'Hospitalisation costs can be significant and unpredictable. Without an Integrated Shield Plan, all costs above MediShield Life\'s basic coverage would need to come from MediSave or out-of-pocket.',
      steps: [
        'Confirm whether an Integrated Shield Plan (IP) is active',
        'Check if IP premiums can continue to be paid from MediSave in retirement',
        'Review whether a rider is in place to cover co-payment obligations',
      ],
      prompts: {
        softOpen:  'I\'d like to check on one area that often gets overlooked — hospital coverage. If you needed to be admitted to a private or restructured hospital today, do you know what your out-of-pocket costs would be?',
        discovery: 'Are you currently on a MediShield Life-only plan, or do you have an Integrated Shield Plan? And do you know whether the premium is being paid from MediSave?',
        reframe:   'Hospital coverage is less about probability and more about the cost of being unprotected. A single hospitalisation without an IP can cost tens of thousands. In retirement, that directly reduces the savings you\'ve built.',
        closing:   'It may be worth confirming your current hospital coverage level. If there\'s a gap, we can address it relatively quickly — it\'s one of the more straightforward areas to resolve.',
      },
    })
  }

  // Long-Term Care
  if (hasLtcCover === false || (hasLtcCover === null && lifeExp > 80)) {
    areas.push({
      key:      'ltc',
      title:    'Long-Term Care Risk',
      tier:     1,
      severity: lifeExp > 85 ? 'important' : 'recommended',
      reason:   `With a life expectancy of ${lifeExp} and no long-term care coverage on record, there may be an unaddressed risk of significant eldercare costs in the later years of retirement.`,
      meaning:  'Professional care in Singapore — whether at home or in a care facility — can cost $2,000–$5,000 or more per month. Without a plan, these costs could draw heavily on the savings intended to fund the rest of retirement.',
      steps: [
        'Review CareShield Life enrolment and current monthly benefit amount',
        'Explore whether a CareShield Life supplement would provide adequate daily benefit',
        'Consider setting aside a dedicated healthcare reserve of at least $100,000 by retirement',
      ],
      prompts: {
        softOpen:  'There\'s an area that doesn\'t come up as often but matters significantly for long-term retirement security — long-term care. Have you thought about what happens if, later in life, you need daily assistance with activities like dressing, bathing, or mobility?',
        discovery: 'Professional care in Singapore can cost $2,000–$5,000 a month or more. If that need arose in your 80s, where would you see that cost coming from within your retirement plan?',
        reframe:   'Long-term care isn\'t just a health issue — it is a significant financial risk that tends to arrive late in retirement, when other income sources may be declining. Having a plan for this specifically means the rest of the retirement savings can stay on track.',
        closing:   'It may be worth reviewing your CareShield Life coverage level and exploring whether a supplement would provide a more adequate monthly benefit if the need arises.',
      },
    })
  }

  // ── Tier 2: Retirement gap and income shortfall ────────────────────────────

  // Retirement funding gap
  if (gap > 0) {
    const severity = gap / Math.max(retirementCorpusNeeded, 1) > 0.5 ? 'critical' : 'important'
    const gapPct   = retirementCorpusNeeded > 0 ? Math.round((gap / retirementCorpusNeeded) * 100) : 0
    areas.push({
      key:      'gap',
      title:    'Retirement Funding Gap',
      tier:     2,
      severity,
      reason:   `Based on the assumptions entered, projected assets of ${formatCurrency(projectedAssets)} may fall approximately ${formatCurrency(gap)} (${gapPct}%) short of the estimated corpus needed. This could suggest that further accumulation action may be needed.`,
      meaning:  'A retirement funding gap does not necessarily mean the client cannot retire — but it may mean that the current plan, if unchanged, could result in a shortfall later in retirement. The earlier this is addressed, the lower the required monthly effort.',
      steps: [
        `One possible approach is to increase monthly contributions by approximately ${formatCurrency(gapMonthly)} to reduce this gap over the remaining ${yearsToRetire} years`,
        'Reviewing asset allocation for higher long-run growth potential may also help narrow the gap',
        'It may be worth modelling the impact of a 2–3 year retirement deferral on the overall picture',
      ],
      prompts: {
        softOpen:  `When you picture retirement at ${retireAge}, are you imagining a basic comfortable lifestyle, or one where you still have freedom to travel, support family, and pursue your interests without restriction?`,
        discovery: `Based on the current plan, there may be a gap of roughly ${formatCurrency(gapMonthly)}/month between what you\'re projected to have and what you\'ve indicated you need. If that were the case, would you prefer to address it now while you have ${yearsToRetire} years ahead, or would you make adjustments closer to retirement?`,
        reframe:   'The concern is not just whether there is money at retirement — it is whether that money continues to give you genuine choices throughout retirement, including the later years when expenses often increase rather than decrease.',
        closing:   'Would it be useful to explore together what a realistic monthly adjustment could look like to meaningfully reduce this gap — while still leaving your current lifestyle comfortable?',
      },
    })
  }

  // CPF LIFE income floor shortfall
  if (!cpfFrsReached && retireAge >= 55) {
    const urgencyBonus = cpfBrsReached ? 0 : 15
    areas.push({
      key:      'cpf',
      title:    'CPF LIFE Income Floor',
      tier:     2,
      severity: cpfBrsReached ? 'recommended' : 'important',
      reason:   `Combined CPF (OA + SA + MA) of ${formatCurrency(cpfTotal)} has not yet reached the Full Retirement Sum (FRS $198,800). This may suggest that the guaranteed CPF LIFE monthly payout could be lower than optimal.`,
      meaning:  'A lower CPF balance translates to a smaller CPF LIFE monthly payout — reducing the guaranteed income floor in retirement. This may require a greater reliance on portfolio drawdowns, which are subject to market conditions.',
      steps: [
        'Consider topping up CPF SA or RA via the Retirement Sum Topping-Up Scheme (RSTU) — deductible up to $8,000/year',
        'Modelling the difference between BRS and FRS payouts may help clarify whether a top-up is worthwhile',
        'Deferring CPF LIFE start date to age 70 could increase the monthly payout by approximately 35%',
      ],
      prompts: {
        softOpen:  'When thinking about retirement income, how important is it to you to have a portion that arrives reliably every month — regardless of what markets are doing?',
        discovery: `CPF LIFE can provide that kind of guaranteed floor. Based on your current CPF balance of ${formatCurrency(cpfTotal)}, it may be worth exploring whether the projected payout would comfortably cover your essential monthly expenses in retirement.`,
        reframe:   'CPF is often underestimated as a retirement tool. A strong CPF balance is not just savings — it is essentially a lifelong annuity that cannot be outlived. That certainty has significant value, particularly in the later years of a long retirement.',
        closing:   'Would it be worth looking at how much difference a targeted CPF top-up could make to your monthly payout, and whether the tax relief makes it an efficient step for you this year?',
      },
    })
  }

  // Weak income floor
  const passiveCoverageRatio = inflationAdjMonthlyNeeds > 0
    ? passiveIncomeMonthly / inflationAdjMonthlyNeeds
    : 0
  if (passiveCoverageRatio < 0.5 && retirementDuration > 10) {
    areas.push({
      key:      'income_floor',
      title:    'Retirement Income Floor',
      tier:     2,
      severity: passiveCoverageRatio < 0.25 ? 'important' : 'recommended',
      reason:   `Guaranteed passive income of ${formatCurrency(passiveIncomeMonthly)}/mo may cover approximately ${Math.round(passiveCoverageRatio * 100)}% of estimated monthly needs at retirement. This could indicate a significant reliance on portfolio drawdowns over a ${retirementDuration}-year retirement.`,
      meaning:  'Without a reliable income floor, the client\'s retirement spending is largely dependent on portfolio performance. A prolonged market downturn in the early years of retirement — sequence-of-returns risk — could significantly impact the long-term sustainability of the plan.',
      steps: [
        'Building CPF LIFE to FRS or ERS level may provide a stronger guaranteed income base',
        'It may be worth exploring annuity products to convert a portion of savings into a reliable lifetime income',
        'Singapore Savings Bonds (SSB) could provide a low-risk income layer for the early years of retirement',
      ],
      prompts: {
        softOpen:  'When it comes to retirement income, some people value certainty — knowing a fixed amount arrives every month no matter what markets do. Others prefer flexibility and potential growth. Which approach resonates more with you?',
        discovery: `Your projected guaranteed income in retirement may cover around ${Math.round(passiveCoverageRatio * 100)}% of your estimated monthly needs. The remaining portion would need to come from portfolio drawdowns, which depend on market conditions. How comfortable are you with that level of uncertainty?`,
        reframe:   'A reliable income floor gives a financial foundation that does not depend on markets. Everything above that level becomes a bonus rather than a necessity. It is a different way of thinking about retirement security — and one that tends to reduce anxiety significantly.',
        closing:   'It may be worth exploring how to build up the guaranteed portion of your retirement income so that the variable portion is less critical to your day-to-day security. Would that be a useful direction to explore?',
      },
    })
  }

  // Unrealistic retirement timeline
  if (yearsToRetire < 10 && gap > retirementCorpusNeeded * 0.3) {
    areas.push({
      key:      'retire_age',
      title:    'Retirement Timeline Review',
      tier:     2,
      severity: yearsToRetire < 5 ? 'critical' : 'important',
      reason:   `With ${yearsToRetire} years to the target retirement age and a significant projected shortfall, the current timeline may benefit from review. Each additional working year adds contributions and compounding while shortening the drawdown period.`,
      meaning:  'Retirement timing is one of the highest-leverage adjustments available. Even a 2–3 year extension can meaningfully change the financial picture — without requiring a significant increase in monthly contributions.',
      steps: [
        `Modelling the retirement plan at ${retireAge}, ${retireAge + 2}, and ${retireAge + 5} would provide a useful comparison`,
        'A phased retirement — part-time work while beginning to draw CPF LIFE — may offer a middle path',
        'Aligning the retirement date with CPF LIFE start date optimises the guaranteed income floor',
      ],
      prompts: {
        softOpen:  `I\'d like to explore your retirement timeline. Is the target of ${retireAge} something you\'ve thought about carefully, or is it more of a general aspiration at this stage?`,
        discovery: `From a planning standpoint, each additional year of work has a compounding effect — contributions continue, assets grow further, and the drawdown period shortens. Have you considered what the numbers look like at ${retireAge + 3} or ${retireAge + 5}?`,
        reframe:   'Retirement age is often one of the most powerful levers in the entire plan. It is worth knowing what the numbers look like at a few different ages, so that any decision is made with full visibility into the trade-offs.',
        closing:   `Would it be helpful to model what the plan looks like at a few different retirement ages, so you can see the difference clearly before deciding?`,
      },
    })
  }

  // ── Tier 3: Accumulation and optimisation ─────────────────────────────────

  // Low savings rate
  if (savingsRate < 0.15 && gap >= 0) {
    areas.push({
      key:      'savings',
      title:    'Monthly Accumulation Rate',
      tier:     3,
      severity: savingsRate < 0.08 ? 'critical' : 'important',
      reason:   `Based on the information entered, the estimated savings rate is approximately ${(savingsRate * 100).toFixed(1)}% — which may be below the 15–20% typically recommended for retirement adequacy.`,
      meaning:  'Insufficient monthly savings means the retirement corpus builds slowly, making it harder to recover ground later. Consistency of saving often matters more than the absolute amount, especially over a long accumulation period.',
      steps: [
        'Setting up an automated recurring transfer on every payday can establish the habit without relying on willpower',
        'Reviewing monthly outflows to identify 2–3 areas of discretionary spending may reveal room to redirect',
        'Maximising CPF Voluntary Contributions (VC) offers both accumulation and tax relief',
      ],
      prompts: {
        softOpen:  'I\'d like to understand your current monthly cash flow a little better. After regular commitments — housing, daily expenses, insurance — do you feel there is room to do more, or does it already feel quite stretched?',
        discovery: 'If we identified an extra $300–$500 a month through small adjustments, where do you think that money might currently be going? Is it lifestyle spending, or does it genuinely feel fully committed?',
        reframe:   'Accumulation is less about the amount and more about the habit. A manageable monthly commitment started today and maintained consistently tends to outperform a larger sporadic effort — because compounding rewards time above everything else.',
        closing:   'Would it make sense to map out monthly cash flow together so we can identify the best place to redirect — without affecting your current lifestyle significantly?',
      },
    })
  }

  // Cash-heavy portfolio
  const cashRatio = totalAssetsToday > 0 ? cashBalance / totalAssetsToday : 0
  if (cashRatio > 0.35 && yearsToRetire > 5 && totalAssetsToday > 0) {
    areas.push({
      key:      'cash_heavy',
      title:    'Cash-Heavy Portfolio',
      tier:     3,
      severity: cashRatio > 0.55 ? 'important' : 'recommended',
      reason:   `Cash and savings may represent approximately ${Math.round(cashRatio * 100)}% of investable assets. This could indicate that a meaningful portion of the client\'s wealth is generating returns that may not keep pace with inflation over time.`,
      meaning:  'Idle cash loses purchasing power in real terms each year. With ${yearsToRetire} years to retirement, capital that is not growing at or above inflation may effectively be shrinking in value.',
      steps: [
        'Identifying cash above a 6-month emergency fund may reveal capital that could be better deployed',
        'A Regular Savings Plan (RSP) into a diversified ETF can put excess cash to work systematically',
        'Singapore Savings Bonds (SSB) may offer a lower-risk intermediate step for those not yet comfortable with market exposure',
      ],
      prompts: {
        softOpen:  'Looking at the asset mix, a significant portion appears to be in savings or cash. Is that a deliberate liquidity strategy, or is it more that you haven\'t found the right place to deploy it yet?',
        discovery: 'Inflation is essentially a silent cost on idle cash. Over 10–15 years, savings earning below 2% erode meaningfully against a 3% inflation backdrop. How aware are you of this effect on the overall plan?',
        reframe:   'Cash is important for emergencies and short-term needs. Beyond that buffer, the question worth asking is whether the remaining portion is working as hard as it could for retirement. Based on what we\'ve reviewed, there may be room to improve.',
        closing:   'If we could identify a structure that kept your liquidity intact but put the excess to work at a higher long-run return — would that be something worth exploring together?',
      },
    })
  }

  // Weak investment participation
  const investRatio = totalAssetsToday > 0 ? investmentBalance / totalAssetsToday : 0
  if (investRatio < 0.2 && yearsToRetire > 10 && totalAssetsToday > 0) {
    areas.push({
      key:      'weak_invest',
      title:    'Investment Participation',
      tier:     3,
      severity: 'recommended',
      reason:   `Investment assets may represent approximately ${Math.round(investRatio * 100)}% of the portfolio. A longer accumulation horizon typically benefits from a higher allocation to growth assets.`,
      meaning:  'CPF and savings alone are unlikely to consistently outperform inflation over a 15–20 year period. Diversified investments in the growth phase of retirement planning typically provide a meaningful uplift to long-term outcomes.',
      steps: [
        'A low-cost diversified ETF via Regular Savings Plan (RSP) can provide systematic exposure without market timing',
        'Investment-Linked Policies (ILPs) can blend protection and investment for those earlier in the accumulation journey',
        'Reviewing CPFIS eligibility may reveal an option to put OA savings to work at a higher potential return',
      ],
      prompts: {
        softOpen:  'I\'d like to understand your current thinking on investments. Have you had experience with investing in the past, and how has that shaped the way you approach it today?',
        discovery: 'CPF contributions are important, but they grow at a fixed rate. On a 15–20 year horizon, a portion invested in diversified assets has historically produced meaningfully higher long-run returns. Is that something you\'ve considered?',
        reframe:   'Investment participation does not have to mean taking on significant risk. There are systematic ways to invest — through regular contributions into diversified funds — that smooth out short-term volatility and build wealth progressively without requiring active management.',
        closing:   'Would you be open to exploring some options that could give your money better long-run growth potential, calibrated to a level of risk you\'re genuinely comfortable with?',
      },
    })
  }

  // Healthcare / MediSave
  if (!cpfMaFunded) {
    areas.push({
      key:      'medisave',
      title:    'Healthcare Cost Buffer',
      tier:     3,
      severity: 'recommended',
      reason:   `MediSave balance may be below the Basic Healthcare Sum (BHS $66,000). This could limit the ability to cover hospitalisation and Integrated Shield Plan premiums through MediSave in retirement.`,
      meaning:  'Medical costs in retirement are less predictable than most other expenses and tend to cluster in the later years. Insufficient MediSave may mean those costs need to come from retirement savings, reducing the funds available for living expenses.',
      steps: [
        'Voluntary cash top-ups to MediSave are deductible up to $8,000 per year — a tax-efficient way to build this buffer',
        'Confirming that the Integrated Shield Plan premium can continue to be paid from MediSave in retirement is a useful early step',
      ],
      prompts: {
        softOpen:  'As we plan for retirement, healthcare is one of the costs that tends to increase significantly with age. How are you currently thinking about covering medical expenses in your 70s and beyond?',
        discovery: 'MediSave plays a central role in paying for hospitalisation and Integrated Shield Plan premiums in retirement. If your MediSave were depleted early, those premiums would need to come from your other retirement income. Is that something you\'ve factored into the plan?',
        reframe:   'Medical costs in retirement are less predictable than most other expenses — and they tend to cluster in the later years when other income sources may be declining. A dedicated healthcare buffer is one of the more practical ways to protect the rest of the retirement plan.',
        closing:   'Would it be helpful to review your MediSave balance alongside your Integrated Shield coverage, and explore whether there\'s a case for building this buffer while the tax relief is available?',
      },
    })
  }

  // ── Tier 4: Advanced planning ──────────────────────────────────────────────

  // Estate / legacy (only when fundamentals are strong)
  const fundamentalsStrong = gap <= 0 && coverageScore >= 10 && cpfFrsReached
  if (fundamentalsStrong) {
    areas.push({
      key:      'estate',
      title:    'Estate & Legacy Planning',
      tier:     4,
      severity: 'recommended',
      reason:   'Based on the information entered, the client\'s retirement plan appears well-positioned. Attention may usefully shift toward wealth transfer, estate structure, and legacy planning.',
      meaning:  'Without an estate plan, wealth may not reach intended beneficiaries efficiently. Estate administration without a Will can be time-consuming and costly, and CPF without a nomination bypasses the estate process entirely.',
      steps: [
        'Reviewing and updating CPF nomination across all accounts is a practical first step',
        'Confirming whether a Will is in place and reflects current intentions',
        'A Lasting Power of Attorney (LPA), if not already in place, provides important protection while in good health',
      ],
      prompts: {
        softOpen:  'With your retirement plan looking well-positioned, it may be a good time to think about the next layer — how you want your wealth to be structured, preserved, and eventually transferred.',
        discovery: 'Have you considered what happens to your CPF savings if something happened to you? Do you have a nomination in place, and does it reflect your current wishes?',
        reframe:   'Estate planning is not about age — it is about ensuring that what you\'ve built reaches the people you intend, in the way you intend, with minimal friction. The best time to set it up is when there is no urgency.',
        closing:   'Would it be worth taking some time at our next meeting to review your CPF nomination, confirm whether a Will is in place, and explore an LPA while you\'re in good health?',
      },
    })
  }

  // Sort by tier score descending
  return areas.sort((a, b) => {
    const sa = tierScore(a.tier, a.severity, a.tier === 1 ? 10 : 0)
    const sb = tierScore(b.tier, b.severity, b.tier === 1 ? 10 : 0)
    return sb - sa
  })
}

// ─── Planning category recommendation ────────────────────────────────────────

function generatePlanningCategory(
  topThree: FocusAreaIntel[],
  inp: IntelligenceInput,
): PlanningCategoryRec {
  const topKey = topThree[0]?.key ?? ''

  if (topKey === 'protection' || topKey === 'hospital') {
    return {
      category: 'Protection Review',
      why: 'The highest-priority planning need identified is related to protection coverage. Before advancing retirement accumulation, it is important to verify that the financial plan is adequately protected against pre-retirement risks that could derail it.',
      agenda: [
        'Fact-find on all existing life, CI, TPD, and hospital coverage with sum assured amounts',
        'Identify any coverage gaps relative to current income, liabilities, and dependent needs',
        'Discuss whether any gaps need to be addressed before or alongside retirement planning',
      ],
    }
  }
  if (topKey === 'ltc') {
    return {
      category: 'Long-Term Care Planning',
      why: 'Long-term care risk has been identified as a planning priority, particularly given the projected life expectancy. This area is often left unaddressed until it becomes urgent.',
      agenda: [
        'Review CareShield Life enrolment and current monthly benefit adequacy',
        'Explore CareShield Life supplement options and cost-benefit analysis',
        'Discuss whether a dedicated healthcare reserve forms part of the retirement plan',
      ],
    }
  }
  if (topKey === 'gap' || topKey === 'retire_age') {
    return {
      category: 'Retirement Accumulation',
      why: 'A retirement funding gap has been identified as the primary planning concern. Closing this gap requires a structured approach to increasing contributions, optimising investment allocation, or reviewing the retirement timeline.',
      agenda: [
        'Review current monthly cash flow to identify sustainable contribution increases',
        'Discuss asset allocation and whether the current mix supports the required long-run return',
        'Model the retirement plan under 2–3 different timeline scenarios',
      ],
    }
  }
  if (topKey === 'cpf') {
    return {
      category: 'CPF LIFE Planning',
      why: 'Strengthening the CPF income floor has been identified as a key planning priority. Building toward FRS or ERS provides a guaranteed lifelong income stream that reduces dependence on portfolio drawdowns.',
      agenda: [
        'Review current CPF balances across OA, SA, and MA',
        'Model the difference in CPF LIFE monthly payout at BRS vs FRS vs ERS',
        'Discuss the Retirement Sum Topping-Up Scheme (RSTU) and available tax relief',
      ],
    }
  }
  if (topKey === 'income_floor') {
    return {
      category: 'Retirement Income Planning',
      why: 'Building a reliable retirement income floor has been identified as a priority. A strong guaranteed income base reduces sequence-of-returns risk and supports retirement sustainability.',
      agenda: [
        'Map out all projected retirement income sources and their reliability',
        'Explore annuity or CPF LIFE enhancement options to strengthen the guaranteed floor',
        'Discuss the role of portfolio drawdown within the overall income plan',
      ],
    }
  }
  if (topKey === 'savings' || topKey === 'cash_heavy') {
    return {
      category: inp.savingsRate < 0.08 ? 'Cashflow Restructuring' : 'Investment Portfolio Review',
      why: inp.savingsRate < 0.08
        ? 'Cash flow optimisation has been identified as a foundational need. Without a sustainable savings rate, other planning recommendations are difficult to implement effectively.'
        : 'Portfolio structure and deployment of idle cash has been identified as an opportunity. Improving the asset mix could meaningfully improve long-run retirement outcomes.',
      agenda: [
        'Map monthly income and expenses in detail to identify savings capacity',
        'Review existing savings and investment instruments and their current return',
        'Identify 1–2 practical adjustments that can be implemented without disrupting lifestyle',
      ],
    }
  }
  if (topKey === 'estate') {
    return {
      category: 'Estate Planning',
      why: 'With the client\'s retirement fundamentals appearing solid, estate and legacy planning is a natural next priority — ensuring that wealth reaches intended beneficiaries effectively.',
      agenda: [
        'Review CPF nomination status across all accounts',
        'Confirm whether a Will is in place and reflects current intentions',
        'Discuss Lasting Power of Attorney (LPA) and its value while the client is in good health',
      ],
    }
  }
  // Default
  return {
    category: 'Retirement Accumulation',
    why: 'A structured review of the overall retirement plan — contributions, allocation, and timeline — is recommended to ensure the plan remains on track.',
    agenda: [
      'Review current retirement assumptions and whether they remain appropriate',
      'Assess whether monthly contributions are aligned with the retirement target',
      'Identify any planning gaps that may need to be addressed in the next 12 months',
    ],
  }
}

// ─── What not to rush into ────────────────────────────────────────────────────

function generateWhatNotToRush(
  topThree: FocusAreaIntel[],
  inp: IntelligenceInput,
): WhatNotToRush[] {
  const items: WhatNotToRush[] = []
  const { coverageScore, gap, savingsRate, cpfMaFunded, readinessScore, yearsToRetire, cashBalance, totalAssetsToday } = inp
  const topKey = topThree[0]?.key

  // If protection is not confirmed, don't rush accumulation
  if (coverageScore === 0 && topKey !== 'estate') {
    items.push({
      warning: 'Do not focus exclusively on investment accumulation before the protection picture is clear.',
      reason:  'A significant illness or disability before retirement can erode savings faster than any investment strategy can rebuild. It may be worth confirming the protection foundation first.',
    })
  }

  // If savingsRate is very low, don't push big commitment plans
  if (savingsRate < 0.08) {
    items.push({
      warning: 'Avoid recommending high commitment monthly savings or investment plans if cash flow is already fully stretched.',
      reason:  'A plan that cannot be maintained consistently is more harmful than a modest plan that is. Sustainability matters more than ambition in the early stages.',
    })
  }

  // If surplus is large, don't chase higher returns unnecessarily
  if (gap < 0 && Math.abs(gap) > inp.retirementCorpusNeeded * 0.5) {
    items.push({
      warning: 'Avoid over-concentrating in illiquid or high-risk instruments in pursuit of additional returns.',
      reason:  'Based on the assumptions entered, the client may already be on track for a strong retirement surplus. The priority at this stage may be protecting what has been built rather than chasing further growth.',
    })
  }

  // If retirement is near, don't push accumulation-focused products
  if (yearsToRetire <= 7 && gap > 0) {
    items.push({
      warning: 'Avoid recommending long lock-in accumulation products without first reviewing the retirement timeline.',
      reason:  `With approximately ${yearsToRetire} years to retirement, product suitability and liquidity in the early drawdown years should be carefully considered.`,
    })
  }

  // Don't discuss estate planning if basics are not secure
  if (readinessScore < 60 && topKey !== 'estate') {
    items.push({
      warning: 'It may be premature to focus on estate or legacy planning before retirement adequacy is secured.',
      reason:  'Legacy planning is most meaningful when the client\'s own retirement is well-funded. Addressing the higher-priority retirement and protection needs first is likely to be more valuable.',
    })
  }

  // If cashflow is unknown (no income entered), don't assume capacity
  if (savingsRate === 0 || !inp.cashBalance) {
    items.push({
      warning: 'Avoid making specific contribution recommendations without first confirming the client\'s actual income and cash flow capacity.',
      reason:  'Savings rate estimates are only as reliable as the income data entered. A conversation about actual monthly cash flow may reveal a different picture.',
    })
  }

  // If cash is very high, don't rush into complex investments
  const cashRatio = totalAssetsToday > 0 ? cashBalance / totalAssetsToday : 0
  if (cashRatio > 0.5) {
    items.push({
      warning: 'Do not rush into complex investment products simply because there is a large cash balance to deploy.',
      reason:  'Understanding the reason for the high cash balance first — whether it is intentional liquidity, risk aversion, or inertia — will lead to a more appropriate recommendation.',
    })
  }

  // CPF-focused clients: don't over-rely on CPF alone
  const cpfRatio = totalAssetsToday > 0 ? inp.cpfTotal / totalAssetsToday : 0
  if (cpfRatio > 0.6 && yearsToRetire > 10) {
    items.push({
      warning: 'Avoid over-reliance on CPF as the sole retirement vehicle without diversification into other asset classes.',
      reason:  'While CPF is a strong foundation, a portfolio that is too heavily concentrated in CPF may limit flexibility and access to liquidity in retirement.',
    })
  }

  return items.slice(0, 4)
}

// ─── Next Appointment Prep ────────────────────────────────────────────────────

function generateAppointmentPrep(
  topThree: FocusAreaIntel[],
  category: PlanningCategoryRec,
  inp: IntelligenceInput,
): AppointmentPrep {
  const k1 = topThree[0]?.title ?? 'Retirement planning review'
  const k2 = topThree[1]?.title ?? 'Income floor planning'
  const k3 = topThree[2]?.title ?? 'Asset accumulation strategy'

  const q1 = topThree[0]?.prompts.softOpen   ?? 'What does your ideal retirement lifestyle look like?'
  const q2 = topThree[0]?.prompts.discovery  ?? 'How have you been thinking about funding that lifestyle?'
  const q3 = topThree[1]?.prompts.softOpen   ?? 'How confident are you in your current protection structure?'

  let objection = '"I think what I have now should be enough."'
  let response  = 'That\'s a reasonable starting point. What would be helpful is to look at the numbers together so we can confirm whether "enough" aligns with the lifestyle and security you actually want — not just a minimum. The goal is to give you certainty, not to suggest you\'re doing something wrong.'

  const topKey = topThree[0]?.key

  if (topKey === 'protection' || topKey === 'hospital') {
    objection = '"I already have insurance — I\'ve had it for years."'
    response  = 'That\'s great to hear. It would be helpful to review the sum assured and coverage terms together, because protection needs change over time as income, liabilities, and family circumstances evolve. The goal is to confirm it\'s still adequate, not to suggest replacing it.'
  } else if (topKey === 'gap' || topKey === 'savings') {
    objection = '"I can\'t afford to save more right now."'
    response  = 'That\'s completely understandable. Rather than pushing for a specific number, it may be more useful to map out the cash flow together first. Sometimes there are small redirections that don\'t feel painful but make a meaningful difference over time.'
  } else if (topKey === 'cpf') {
    objection = '"CPF is locked away — I prefer to keep my money accessible."'
    response  = 'That\'s a fair concern. CPF is illiquid, but that is also part of its value — it cannot be accidentally spent. The question worth exploring is whether the tax savings and guaranteed lifetime payout from a CPF top-up make it worth a portion of the available cash.'
  } else if (topKey === 'estate') {
    objection = '"I\'m still young — estate planning feels too early."'
    response  = 'That\'s actually one of the best times to do it. Estate planning done when there is no urgency is simpler, cheaper, and reflects your wishes more clearly. Waiting until it is needed often means it is done under pressure or cannot be done at all.'
  }

  const followUp = topKey === 'protection' || topKey === 'hospital'
    ? 'Request copies of existing policy documents before the next appointment, or use the fact-find to capture coverage details in advance.'
    : topKey === 'gap' || topKey === 'savings'
    ? 'Prepare a cash flow summary and review whether any products in the current portfolio can be restructured to increase contribution without reducing take-home significantly.'
    : topKey === 'cpf'
    ? 'Check CPF statement and confirm current SA/RA balances and eligibility for RSTU top-up before the appointment.'
    : 'Review the full retirement projection together and confirm which planning category to prioritise next.'

  return {
    keyPoints: [k1, k2, k3],
    questions:  [q1, q2, q3],
    objection,
    response,
    followUp,
  }
}

// ─── Advisor Intelligence Summary ─────────────────────────────────────────────

function generateAdvisorIntelligence(
  topThree: FocusAreaIntel[],
  inp: IntelligenceInput,
): AdvisorIntelligence {
  const {
    gap, readinessScore, status, yearsToRetire, retireAge,
    coverageScore, passiveIncomeMonthly, inflationAdjMonthlyNeeds,
    projectedAssets, retirementCorpusNeeded, cpfFrsReached,
  } = inp

  const topKey  = topThree[0]?.key ?? ''
  const surplus = gap < 0

  // Overall view
  let overallView = ''
  if (surplus && readinessScore >= 75) {
    overallView = `Based on the assumptions entered, this client appears to be in a relatively strong position for retirement. Projected assets may significantly exceed the estimated corpus required, suggesting that the financial trajectory is broadly on track. The primary area worth reviewing at this stage may be ${topKey === 'protection' || topKey === 'hospital' ? 'protection coverage' : 'income floor building and portfolio optimisation'}, rather than accumulation volume.`
  } else if (status === 'slightly_behind') {
    overallView = `Based on the assumptions entered, the client\'s retirement plan is in a reasonable position but may benefit from some targeted adjustments. The projected assets may not fully cover the estimated corpus required, and one or more planning areas could be strengthened to improve the overall outlook. This does not suggest the client is unable to retire as planned — it may suggest that some refinement to the current approach is worth exploring.`
  } else if (status === 'moderate_shortfall') {
    overallView = `Based on the assumptions entered, there may be a meaningful gap between the current trajectory and the estimated retirement target. This could indicate that the current plan — if unchanged — may result in a shortfall later in retirement. However, with ${yearsToRetire} years remaining, there is still time to make meaningful adjustments. The earlier action is taken, the lower the required monthly effort.`
  } else {
    overallView = `Based on the assumptions entered, the client\'s retirement position may require more significant attention. The projected gap and readiness score suggest that material adjustments to contributions, asset allocation, retirement timing, or lifestyle expectations may be needed. It is important to approach this carefully and avoid creating alarm — the numbers reflect the current plan, and plans can change.`
  }

  // Main concern
  const mainConcern = topThree[0]
    ? `The most pressing planning concern identified is: ${topThree[0].title}. ${topThree[0].reason}`
    : 'No specific planning concerns were identified — the overall retirement position appears well-structured based on the information entered.'

  // Why it matters
  const whyItMatters = topThree[0]?.meaning
    ?? 'The retirement plan appears broadly sound. Ongoing review and fine-tuning will remain important as circumstances change.'

  // Clarify with client
  const clarify: [string, string, string] = [
    topKey === 'protection' || topKey === 'hospital'
      ? 'What protection policies does the client currently hold, and what are the current sum assured amounts for Life, CI, and TPD coverage?'
      : surplus
      ? 'Has the client considered what their ideal retirement lifestyle actually looks like — and whether the projected surplus supports that lifestyle or more?'
      : 'What is the client\'s actual monthly income, and what flexibility exists in their current cash flow to increase contributions?',

    topKey === 'cpf' || topKey === 'income_floor'
      ? 'How does the client feel about income certainty versus flexibility in retirement — do they prioritise a guaranteed floor or prefer portfolio drawdown flexibility?'
      : topKey === 'protection'
      ? 'Does the client understand the difference between life insurance, critical illness coverage, and hospital coverage — and which areas they may currently be missing?'
      : 'What is the client\'s risk appetite for investments, and how has their experience with market volatility shaped their current approach?',

    yearsToRetire <= 10
      ? 'Has the client thought carefully about the transition into retirement — specifically, how they will manage the shift from accumulation to drawdown?'
      : 'What does the client expect their biggest financial concern to be in retirement — healthcare, outliving savings, or supporting family?',
  ]

  // Conversation direction
  let conversationDirection = ''
  if (topKey === 'protection' || topKey === 'hospital' || topKey === 'ltc') {
    conversationDirection = `Open with a protection needs discussion before reviewing retirement numbers. The client\'s financial foundation may be stronger than average, which makes this a good time to put the right protection structure in place without financial pressure. Frame it as confirmation of what\'s already in place, not as identifying something wrong.`
  } else if (topKey === 'gap' || topKey === 'retire_age') {
    conversationDirection = `The retirement gap conversation should begin with lifestyle expectations before discussing numbers. Understanding what the client actually wants retirement to look like — not just a monthly income figure — will help frame the gap in a meaningful way. Avoid presenting the shortfall as a problem before establishing what it means for them personally.`
  } else if (topKey === 'cpf' || topKey === 'income_floor') {
    conversationDirection = `Focus on the concept of a reliable income floor before discussing portfolio growth. Many clients are more interested in certainty than returns — and CPF LIFE is one of the most underutilised tools for providing that certainty. Frame CPF top-up as building a guaranteed monthly income, not just adding to savings.`
  } else if (topKey === 'savings' || topKey === 'cash_heavy') {
    conversationDirection = `Start by understanding the client\'s relationship with money — particularly why cash is sitting idle or savings rates are lower than expected. There is often a behavioural or emotional reason rather than a pure capacity issue. Addressing that context will make any practical recommendation more likely to be acted on.`
  } else {
    conversationDirection = `With the financial fundamentals appearing solid, the conversation may naturally shift toward legacy, estate structure, and long-term wealth transfer. This is typically a positive conversation — it affirms that the client has built something worth protecting and planning for.`
  }

  // Next step
  const suggestedNextStep = topKey === 'protection' || topKey === 'hospital'
    ? 'Request copies of existing policy documents or conduct a protection fact-find before the next appointment. A complete picture of existing coverage is needed before any recommendations can be made.'
    : topKey === 'gap' || topKey === 'savings'
    ? `Prepare a detailed cash flow analysis and model the retirement plan at current vs. target contribution levels. Bring specific numbers to the next appointment so the conversation can move from abstract to actionable.`
    : topKey === 'cpf'
    ? `Review the client\'s CPF statement in detail. Calculate the projected CPF LIFE payout at current balance versus FRS, and prepare a simple comparison to bring to the next appointment.`
    : topKey === 'estate'
    ? 'Prepare an estate planning fact-find covering existing Will, CPF nomination status, LPA, and intended beneficiaries. A simple checklist format tends to work well for this type of conversation.'
    : `Review the overall retirement plan summary and prepare 2–3 specific, actionable recommendations for the next appointment. Prioritise breadth over depth — give the client a clear sense of direction before diving into any one area.`

  return { overallView, mainConcern, whyItMatters, clarifyWithClient: clarify, conversationDirection, suggestedNextStep }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePlanningIntelligence(inp: IntelligenceInput): PlanningIntelligence {
  const allAreas       = generateFocusAreas(inp)
  const topThree       = allAreas.slice(0, 3)
  const planningCategory   = generatePlanningCategory(topThree, inp)
  const whatNotToRush  = generateWhatNotToRush(topThree, inp)
  const appointmentPrep    = generateAppointmentPrep(topThree, planningCategory, inp)
  const advisorIntelligence = generateAdvisorIntelligence(topThree, inp)

  return { focusAreas: allAreas, topThree, planningCategory, whatNotToRush, appointmentPrep, advisorIntelligence }
}
