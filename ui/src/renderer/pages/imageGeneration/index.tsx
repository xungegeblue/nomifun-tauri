/**
 * @license
 * Copyright 2025-2026 NomiFun (nomifun.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ImageGenerationPage — AI-powered image creation workspace.
 *
 * Flow: select scenario → select model → fill dynamic form → generate → view result.
 * API key is passed from frontend (localStorage cache), no backend storage.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Input, Message, Select, Spin, Typography } from '@arco-design/web-react';
import { IconImage, IconLoading } from '@arco-design/web-react/icon';
import { ipcBridge } from '@/common';
import type { IModelInfo, ISchemaField, ISchemaResponse, IGenerateResult } from '@/common/adapter/ipcBridge';
import { listScenarios, resolveSchema, buildPrompt, type ScenarioConfig } from '@/renderer/services/imageScenarios';
import { NomiSchemaForm } from '@/renderer/components/NomiSchemaForm';
import styles from './ImageGeneration.module.css';

const { Title } = Typography;

const API_KEY_STORAGE_KEY = 'nomifun:image:modelverse-api-key';

export default function ImageGenerationPage() {
  // ── Scenario & Model ──
  const scenarios = useMemo(() => listScenarios(), []);
  const [scenario, setScenario] = useState<ScenarioConfig>(scenarios[0]);

  const [models, setModels] = useState<IModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [baseSchema, setBaseSchema] = useState<ISchemaField[]>([]);
  const [schemaDefaults, setSchemaDefaults] = useState<Record<string, unknown>>({});

  // ── Form values ──
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''; } catch { return ''; }
  });

  // ── Result ──
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<IGenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch models on mount ──
  useEffect(() => {
    ipcBridge.image.listModels.invoke()
      .then((list) => {
        setModels(list);
        if (list.length > 0) setSelectedModel(list[0].name);
      })
      .catch((e) => Message.error(`获取模型列表失败: ${e}`));
  }, []);

  // ── Fetch schema when model changes ──
  useEffect(() => {
    if (!selectedModel) return;
    ipcBridge.image.getSchema.invoke({ model: selectedModel })
      .then((resp: ISchemaResponse) => {
        setBaseSchema(resp.fields);
        setSchemaDefaults(resp.defaultValues ?? {});
        setFormValues({});
      })
      .catch((e) => Message.error(`获取参数 Schema 失败: ${e}`));
  }, [selectedModel]);

  // ── Resolved schema (base + scenario overlay) ──
  const resolved = useMemo(
    () => resolveSchema(baseSchema, scenario),
    [baseSchema, scenario],
  );

  // ── Persist API key to localStorage ──
  const handleApiKeyChange = useCallback((val: string) => {
    setApiKey(val);
    try { localStorage.setItem(API_KEY_STORAGE_KEY, val); } catch { /* noop */ }
  }, []);

  // ── Generate ──
  const handleGenerate = useCallback(async () => {
    if (!apiKey) {
      Message.warning('请先填写 API Key');
      return;
    }
    if (!selectedModel) {
      Message.warning('请选择模型');
      return;
    }
    const prompt = String(formValues.prompt ?? '');
    if (!prompt) {
      Message.warning('请填写提示词');
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    // Build scenario-injected prompt
    const scenarioParams: Record<string, unknown> = {};
    for (const f of scenario.extraFields) {
      if (formValues[f.key] != null) scenarioParams[f.key] = formValues[f.key];
    }
    const finalPrompt = buildPrompt(prompt, scenario, scenarioParams);

    // Extract base params (only keys from baseSchema, skip scenario extras)
    const baseKeys = new Set(baseSchema.map((f) => f.key));
    const params: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(formValues)) {
      if (baseKeys.has(k)) params[k] = v;
    }
    params.prompt = finalPrompt;

    // Merge scenario paramOverrides
    Object.assign(params, scenario.paramOverrides);

    try {
      const resp = await ipcBridge.image.generate.invoke({
        model: selectedModel,
        apiKey,
        ...params as any,
      });
      setResult(resp);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      Message.error(`生成失败: ${e?.message ?? e}`);
    } finally {
      setGenerating(false);
    }
  }, [apiKey, selectedModel, formValues, scenario, baseSchema]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Title ── */}
        <div className={styles.title}>
          <IconImage className={styles.titleIcon} />
          <Title heading={5}>AI 生图</Title>
        </div>

        {/* ── Config Card ── */}
        <Card className={styles.configCard} bordered={false}>
          {/* Scenario selector */}
          <div className={styles.section}>
            <span className={styles.sectionLabel}>场景</span>
            <Select
              value={scenario.name}
              onChange={(v) => {
                const s = scenarios.find((x) => x.name === v);
                if (s) setScenario(s);
              }}
              style={{ width: 160 }}
            >
              {scenarios.map((s) => (
                <Select.Option key={s.name} value={s.name}>{s.label}</Select.Option>
              ))}
            </Select>
          </div>

          {/* Model selector */}
          <div className={styles.section}>
            <span className={styles.sectionLabel}>模型</span>
            <Select
              value={selectedModel}
              onChange={setSelectedModel}
              style={{ width: 200 }}
              placeholder={models.length === 0 ? '暂无可用模型' : '选择模型'}
            >
              {models.map((m) => (
                <Select.Option key={m.name} value={m.name}>{m.label}</Select.Option>
              ))}
            </Select>
          </div>

          {/* API Key */}
          <div className={styles.section}>
            <span className={styles.sectionLabel}>API Key</span>
            <Input
              value={apiKey}
              onChange={handleApiKeyChange}
              placeholder="ModelVerse API Key"
              style={{ width: '100%' }}
              type="password"
            />
          </div>

          {/* Dynamic form */}
          {resolved.fields.length > 0 && (
            <div className={styles.formSection}>
              <NomiSchemaForm
                schema={resolved.fields}
                defaults={resolved.defaults}
                values={formValues}
                onChange={setFormValues}
                disabled={generating}
              />
            </div>
          )}

          {/* Generate button */}
          <Button
            type="primary"
            long
            className={styles.generateBtn}
            onClick={handleGenerate}
            loading={generating}
            disabled={!apiKey || !selectedModel}
          >
            {generating ? '生成中...' : '生成图片'}
          </Button>
        </Card>

        {/* ── Result Card ── */}
        <Card className={styles.resultCard} bordered={false} style={{ marginTop: 16 }}>
          {generating && (
            <div className={styles.loading}>
              <Spin size={40} />
              <span className={styles.loadingText}>正在生成，请稍候...</span>
            </div>
          )}

          {error && (
            <div className={styles.error}>
              <Typography.Text type="danger">{error}</Typography.Text>
            </div>
          )}

          {!generating && !error && result && (
            <div className={styles.result}>
              <img
                className={styles.resultImage}
                src={result.imageUrl}
                alt="Generated image"
              />
              <div className={styles.resultMeta}>
                <Typography.Text type="secondary">
                  模型: {result.model}
                </Typography.Text>
              </div>
            </div>
          )}

          {!generating && !error && !result && (
            <div className={styles.emptyResult}>
              <IconImage className={styles.emptyIcon} style={{ fontSize: 48 }} />
              <Typography.Text type="secondary">填写参数后点击生成</Typography.Text>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
