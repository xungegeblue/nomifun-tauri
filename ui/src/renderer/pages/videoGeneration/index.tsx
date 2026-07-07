/**
 * @license
 * Copyright 2025-2026 NomiFun (nomifun.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VideoGenerationPage — AI-powered video creation workspace.
 *
 * Layout: left config panel + right result panel.
 * Flow: select model → fill dynamic form → submit → poll status → view result.
 * API key is passed from frontend (localStorage cache), no backend storage.
 * Task state is maintained in component memory only.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Input, Message, Select, Spin, Typography } from '@arco-design/web-react';
import { IconFileVideo, IconLoading, IconRefresh } from '@arco-design/web-react/icon';
import { ipcBridge } from '@/common';
import type { IVideoModelInfo, IVideoSchemaField, IVideoSchemaResponse, IVideoTaskStatus } from '@/common/adapter/ipcBridge';
import { NomiSchemaForm } from '@/renderer/components/NomiSchemaForm';

const { Title, Text } = Typography;

const API_KEY_STORAGE_KEY = 'nomifun:video:modelverse-api-key';
const POLL_INTERVAL_MS = 10_000;

interface TaskEntry {
  taskId: string;
  model: string;
  status: string;
  urls?: string[];
  errorMessage?: string;
  submitTime?: number;
}

export default function VideoGenerationPage() {
  // ── Model & Schema ──
  const [models, setModels] = useState<IVideoModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [schemaFields, setSchemaFields] = useState<IVideoSchemaField[]>([]);
  const [schemaDefaults, setSchemaDefaults] = useState<Record<string, unknown>>({});

  // ── Form values ──
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [apiKey, setApiKey] = useState<string>(() => {
    try { return localStorage.getItem(API_KEY_STORAGE_KEY) ?? ''; } catch { return ''; }
  });

  // ── Tasks ──
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch models on mount ──
  useEffect(() => {
    ipcBridge.video.listModels.invoke()
      .then((list) => {
        setModels(list);
        if (list.length > 0) setSelectedModel(list[0].name);
      })
      .catch((e) => Message.error(`获取模型列表失败: ${e}`));
  }, []);

  // ── Fetch schema when model changes ──
  useEffect(() => {
    if (!selectedModel) return;
    ipcBridge.video.getSchema.invoke({ model: selectedModel })
      .then((resp: IVideoSchemaResponse) => {
        setSchemaFields(resp.fields as IVideoSchemaField[]);
        setSchemaDefaults(resp.defaultValues ?? {});
        setFormValues({});
      })
      .catch((e) => Message.error(`获取参数 Schema 失败: ${e}`));
  }, [selectedModel]);

  // ── Persist API key ──
  const handleApiKeyChange = useCallback((val: string) => {
    setApiKey(val);
    try { localStorage.setItem(API_KEY_STORAGE_KEY, val); } catch { /* noop */ }
  }, []);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    if (!apiKey) { Message.warning('请先填写 API Key'); return; }
    if (!selectedModel) { Message.warning('请选择模型'); return; }
    const prompt = String(formValues.prompt ?? '');
    if (!prompt) { Message.warning('请填写提示词'); return; }

    setSubmitting(true);
    try {
      // Separate prompt/duration from model-specific params
      const { prompt: _p, duration, ...modelParams } = formValues as Record<string, unknown>;
      const resp = await ipcBridge.video.submit.invoke({
        model: selectedModel,
        apiKey,
        prompt,
        duration: typeof duration === 'number' ? duration : undefined,
        modelParams,
      });

      const newTask: TaskEntry = {
        taskId: resp.taskId,
        model: selectedModel,
        status: 'Pending',
      };
      setTasks((prev) => [newTask, ...prev]);
      Message.success('任务已提交');
    } catch (e: any) {
      Message.error(`提交失败: ${e?.message ?? e}`);
    } finally {
      setSubmitting(false);
    }
  }, [apiKey, selectedModel, formValues]);

  // ── Refresh single task ──
  const refreshTask = useCallback(async (task: TaskEntry) => {
    if (!apiKey) return;
    try {
      const status = await ipcBridge.video.getStatus.invoke({
        task_id: task.taskId,
        api_key: apiKey,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === task.taskId
            ? {
                ...t,
                status: status.taskStatus,
                urls: status.urls,
                errorMessage: status.errorMessage,
              }
            : t
        )
      );
    } catch (e: any) {
      Message.error(`查询状态失败: ${e?.message ?? e}`);
    }
  }, [apiKey]);

  // ── Auto-poll for pending/running tasks ──
  useEffect(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    const hasActive = tasks.some(
      (t) => t.status === 'Pending' || t.status === 'Running'
    );
    if (!hasActive || !apiKey) return;

    pollTimerRef.current = setInterval(() => {
      for (const task of tasks) {
        if (task.status === 'Pending' || task.status === 'Running') {
          refreshTask(task);
        }
      }
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [tasks, apiKey, refreshTask]);

  // ── Status label ──
  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      Pending: '等待中',
      Running: '生成中',
      Success: '已完成',
      Failure: '失败',
      Expired: '已过期',
    };
    return map[status] ?? status;
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      Pending: 'var(--color-warning-6)',
      Running: 'var(--color-primary-6)',
      Success: 'var(--color-success-6)',
      Failure: 'var(--color-danger-6)',
      Expired: 'var(--color-warning-6)',
    };
    return map[status] ?? 'var(--color-text-3)';
  };

  // ── Filter out prompt from schema (we render it separately) ──
  const formSchema = useMemo(
    () => schemaFields.filter((f) => f.key !== 'prompt'),
    [schemaFields]
  );

  return (
    <div style={{ padding: '24px 32px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Title ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexShrink: 0 }}>
        <IconFileVideo style={{ fontSize: 24, color: 'var(--color-primary-6)' }} />
        <Title heading={5} style={{ margin: 0 }}>AI 视频生成</Title>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* ── Left: Config panel ── */}
        <div style={{ width: 380, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <Card bordered={false} style={{ flexShrink: 0 }}>
            {/* Model selector */}
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 72, flexShrink: 0, color: 'var(--color-text-2)' }}>模型</span>
              <Select
                value={selectedModel}
                onChange={setSelectedModel}
                style={{ flex: 1 }}
                placeholder={models.length === 0 ? '暂无可用模型' : '选择模型'}
              >
                {models.map((m) => (
                  <Select.Option key={m.name} value={m.name}>{m.label}</Select.Option>
                ))}
              </Select>
            </div>

            {/* API Key */}
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 72, flexShrink: 0, color: 'var(--color-text-2)' }}>API Key</span>
              <Input
                value={apiKey}
                onChange={handleApiKeyChange}
                placeholder="ModelVerse API Key"
                style={{ flex: 1 }}
                type="password"
              />
            </div>

            {/* Prompt */}
            <div style={{ marginBottom: 12 }}>
              <span style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>提示词</span>
              <Input.TextArea
                value={String(formValues.prompt ?? '')}
                onChange={(val) => setFormValues((prev) => ({ ...prev, prompt: val }))}
                placeholder="描述你想要生成的视频内容..."
                autoSize={{ minRows: 3, maxRows: 6 }}
              />
            </div>

            {/* Dynamic form for model-specific params */}
            {formSchema.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <NomiSchemaForm
                  schema={formSchema as any}
                  defaults={schemaDefaults}
                  values={formValues}
                  onChange={setFormValues}
                  disabled={submitting}
                />
              </div>
            )}

            {/* Submit button */}
            <Button
              type="primary"
              long
              onClick={handleSubmit}
              loading={submitting}
              disabled={!apiKey || !selectedModel}
              icon={<IconFileVideo />}
            >
              {submitting ? '提交中...' : '生成视频'}
            </Button>
          </Card>
        </div>

        {/* ── Right: Result panel ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <Card
            bordered={false}
            title="任务列表"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
            bodyStyle={{ flex: 1, overflowY: 'auto', padding: '12px' }}
          >
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--color-text-3)' }}>
                <IconFileVideo style={{ fontSize: 48, display: 'block', margin: '0 auto 12px' }} />
                <Text type="secondary">提交任务后在此查看进度</Text>
              </div>
            )}

            {tasks.map((task) => (
              <Card
                key={task.taskId}
                bordered
                style={{ marginBottom: 10 }}
                size="small"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text bold>{task.model}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {task.taskId.slice(0, 12)}...
                    </Text>
                    <Text style={{ color: statusColor(task.status), fontWeight: 500 }}>
                      {statusLabel(task.status)}
                    </Text>
                  </div>
                  {(task.status === 'Pending' || task.status === 'Running') && (
                    <Button
                      size="small"
                      icon={<IconRefresh />}
                      onClick={() => refreshTask(task)}
                    >
                      刷新
                    </Button>
                  )}
                </div>

                {/* Error message */}
                {task.errorMessage && (
                  <Text type="danger" style={{ display: 'block', marginTop: 4, fontSize: 12 }}>
                    {task.errorMessage}
                  </Text>
                )}

                {/* Video result */}
                {task.status === 'Success' && task.urls && task.urls.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    {task.urls.map((url, i) => (
                      <video
                        key={i}
                        src={url}
                        controls
                        style={{ width: '100%', maxHeight: 420, borderRadius: 8, marginTop: i > 0 ? 8 : 0 }}
                      />
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
