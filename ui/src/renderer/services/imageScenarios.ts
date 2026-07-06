//! Scenario registry — industry/scene presets managed entirely on frontend.
//!
//! Design: Scenario Overlay pattern — base schema from backend + extra fields from scenario.
//! Scenario params merge into prompt suffix before sending to backend.

import type { ISchemaField } from '@/common/adapter/ipcBridge';

export interface ScenarioConfig {
  name: string;
  label: string;
  extraFields: ISchemaField[];
  paramOverrides: Record<string, unknown>;
  promptSuffixTemplate?: string;
}

const scenarioRegistry: Record<string, ScenarioConfig> = {
  general: {
    name: 'general',
    label: '通用',
    extraFields: [],
    paramOverrides: {},
  },
  social_media: {
    name: 'social_media',
    label: '自媒体',
    extraFields: [
      {
        key: 'platform', fieldType: 'select', label: '目标平台', required: false,
        options: [
          { value: '小红书', label: '小红书' },
          { value: '抖音', label: '抖音' },
          { value: '微博', label: '微博' },
        ],
      },
      {
        key: 'brandColor', fieldType: 'color', label: '品牌色', required: false,
      },
      {
        key: 'contentType', fieldType: 'select', label: '内容类型', required: false,
        options: [
          { value: '封面图', label: '封面图' },
          { value: '海报', label: '海报' },
          { value: '配图', label: '配图' },
        ],
      },
    ],
    paramOverrides: { size: '2k' },
    promptSuffixTemplate: '适合{{platform}}平台，{{contentType}}风格',
  },
  ecommerce: {
    name: 'ecommerce',
    label: '电商',
    extraFields: [
      {
        key: 'productType', fieldType: 'select', label: '商品类型', required: false,
        options: [
          { value: '服装', label: '服装' },
          { value: '数码', label: '数码' },
          { value: '食品', label: '食品' },
        ],
      },
      {
        key: 'imageUsage', fieldType: 'select', label: '图片用途', required: false,
        options: [
          { value: '主图', label: '主图' },
          { value: '详情图', label: '详情图' },
        ],
      },
      {
        key: 'whiteBackground', fieldType: 'toggle', label: '白底图', required: false,
      },
    ],
    paramOverrides: { size: '2k' },
    promptSuffixTemplate: '{{productType}}商品{{imageUsage}}，{{whiteBackground}}拍摄',
  },
  education: {
    name: 'education',
    label: '教育',
    extraFields: [
      {
        key: 'diagramType', fieldType: 'select', label: '图解类型', required: false,
        options: [
          { value: '思维导图', label: '思维导图' },
          { value: '流程图', label: '流程图' },
          { value: '示意图', label: '示意图' },
        ],
      },
    ],
    paramOverrides: {},
    promptSuffixTemplate: '教育图解，{{diagramType}}风格',
  },
};

export function getScenario(name: string): ScenarioConfig {
  return scenarioRegistry[name] ?? scenarioRegistry.general;
}

export function listScenarios(): ScenarioConfig[] {
  return Object.values(scenarioRegistry);
}

/** Merge backend base schema + scenario overlay → final rendering schema. */
export function resolveSchema(
  baseSchema: ISchemaField[],
  scenario: ScenarioConfig,
): { fields: ISchemaField[]; defaults: Record<string, unknown> } {
  const fields = [...baseSchema, ...scenario.extraFields];
  const defaults = { ...scenario.paramOverrides };
  return { fields, defaults };
}

/** Merge scenario params into prompt via suffix template. */
export function buildPrompt(
  basePrompt: string,
  scenario: ScenarioConfig,
  scenarioParams: Record<string, unknown>,
): string {
  if (!scenario.promptSuffixTemplate) return basePrompt;

  let suffix = scenario.promptSuffixTemplate;
  for (const [key, value] of Object.entries(scenarioParams)) {
    suffix = suffix.replaceAll(`{{${key}}}`, String(value));
  }
  // Remove leftover unreplaced placeholders
  suffix = suffix.replaceAll(/\{\{[^}]+\}\}/g, '');

  if (!suffix) return basePrompt;
  return `${basePrompt}, ${suffix}`;
}
