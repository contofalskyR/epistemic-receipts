import type { Adapter, PipelineConfig, TransformedRow } from './types'

export function definePipeline<Raw, Transformed extends TransformedRow>(
  config: PipelineConfig<Raw, Transformed>,
): PipelineConfig<Raw, Transformed> {
  return config
}

export type { Adapter, PipelineConfig, TransformedRow }
