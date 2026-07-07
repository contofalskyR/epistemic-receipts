// Eval item schema — mirrors scripts/build-eval-set.ts types.
// Import this in any scorer or adapter to share type definitions.

export type ItemType = 'as_of_status' | 'transition_attribution' | 'reversal_awareness' | 'negative_control'

export interface GoldAsOf {
  type: 'as_of_status'
  axis: string // FactStatus value or 'RECORDED'
}
export interface GoldAttribution {
  type: 'transition_attribution'
  sourceTitle: string
  sourceDateIso: string | null
}
export interface GoldReversal {
  type: 'reversal_awareness'
  reversed: boolean
  dateIso: string
  datePrecision: string
}
export interface GoldNegControl {
  type: 'negative_control'
  inRecord: false
}
export type Gold = GoldAsOf | GoldAttribution | GoldReversal | GoldNegControl

export interface EvalItem {
  id: string
  pipeline_version: string
  type: ItemType
  claim_id: string | null
  prompt: string
  gold: Gold
  receipts: string[]
  construction_method: string
  pipeline_provenance: {
    seed: number
    snapshot_date: string
    slot?: string
    transition_ids?: string[]
  }
}

// Model answer shape (what the reference adapter expects to score)
export interface ModelAnswer {
  item_id: string
  answer: string // free-text or JSON string from the model
}

// Per-item score record
export interface ItemScore {
  item_id: string
  type: ItemType
  correct: boolean
  partial?: boolean // for attribution (date ok, title fuzzy)
  details?: string
}

// Aggregate run result
export interface RunResult {
  model: string
  eval_version: string
  total: number
  by_type: Record<ItemType, { n: number; correct: number; accuracy: number }>
  overall_accuracy: number
  temporal_confusion?: TemporalConfusionEntry[]
  mis_calibrated_types: ItemType[]
  timestamp: string
}

// Temporal confusion: predicted axis vs gold, binned by days-from-transition
export interface TemporalConfusionEntry {
  gold_axis: string
  predicted_axis: string
  days_from_transition: number // negative = before, positive = after
  count: number
}
