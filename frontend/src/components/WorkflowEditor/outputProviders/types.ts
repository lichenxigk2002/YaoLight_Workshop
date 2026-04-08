import type React from 'react';

export type OutputFormatId = string; // e.g. "json" | "markdown" | "text"
export type OutputDestinationId = string; // e.g. "file" | "api"

export interface OutputFormatProvider {
  id: OutputFormatId;
  label: string;
  description?: string;
  /**
   * 前端展示分组（像 AI 节点那样：大类 -> 小类）
   * 仅影响 UI，不影响后端值
   */
  category?: {
    id: string;
    label: string;
    order?: number;
  };
  /**
   * 在同一 category 内的排序（越小越靠前）
   */
  order?: number;
  /**
   * 后端 output_node.go 的 format 字段会按这个值选择 provider
   * 注意：后端目前支持 json/markdown(md)/text(txt)
   */
  backendValue: string;
  fileExtensions?: string[];
}

export interface OutputDestinationProvider {
  id: OutputDestinationId;
  label: string;
  description?: string;
  /**
   * destination 只是投递意图；当前版本都会生成 artifact
   * 后端会在 destination=api 时强制要求存在 taskId
   */
  backendValue: string;
}

export interface OutputNodeExtraConfigPartProps {
  formatId?: OutputFormatId;
  destinationId?: OutputDestinationId;
}

export type OutputNodeExtraConfigPart = React.FC<OutputNodeExtraConfigPartProps>;

