# Plan: AI 生图模块 (`nomifun-image`) 执行计划

> 计划包位置: helloagents/plan/image-module-plan.md
> 状态: 待执行

---

## 一、设计模式选型记录

### 核心问题

生图模块面临两个维度的参数差异：
- **维度1**：不同模型（豆包、Midjourney、SD 等）的参数结构不同
- **维度2**：不同行业/场景（自媒体、电商、教育等）需要不同的参数预设和扩展字段

### 选用设计模式

| 模式 | 用在哪里 | 解决什么问题 | 为什么 |
|------|---------|-------------|--------|
| **Registry** | 后端模型管理 | 模型注册与查找 | 随时新增模型，零改动扩展。新模型只需注册一个 Provider，不影响已有逻辑 |
| **Strategy** | 后端模型适配 | 不同模型的 API 调用差异 | 每个模型有自己的 Adapter，把差异封装在各自的实现里，上层只调统一接口 |
| **Schema-driven** | 前端动态表单 | 模型参数表单自动适配 | 前端不硬编码表单，用 JSON Schema 驱动渲染。模型切换只需换 Schema，一个 `<DynamicForm>` 覆盖所有模型 |
| **Scenario Overlay** | 前端场景叠加 | 行业/场景扩展参数 | 行业场景是前端的事，前端拿到模型 baseSchema 后叠加场景预设，提交时合并到 prompt |

### 关键决策：行业/场景放在前端，不放后端

**理由：**
1. `platform`、`brand_color`、`content_type` 这些场景参数，后端根本用不上，最终只是拼到 prompt 里当提示词
2. 场景字段只影响前端表单渲染，不影响后端 API 调用格式
3. 新增场景只需前端加个 TypeScript 配置，不用改 Rust 代码
4. 关注点分离：后端是"翻译层"（统一参数→模型 API），前端是"表达层"（场景适配 + prompt 组合）

### 为什么不用其他模式

| 模式 | 问题 |
|------|------|
| **Abstract Factory** | 会为每个(模型×行业)组合创建具体类，N×M 组合爆炸，维护噩梦 |
| **Template Method** | 继承层次太深，模型差异大时模板方法变成"空洞骨架" |
| **硬编码表单组件** | 每个模型一个表单文件，新增模型=新增组件，前端代码线性膨胀 |
| **纯继承** | 模型和场景是正交维度，继承只能处理线性维度 |
| **后端管理行业** | 行业字段后端用不上，增加后端复杂度，每次加场景都要改 Rust |

---

## 二、整体架构

### 架构图

```
┌──────────────────────────────────────────────────┐
│                    前端                            │
│                                                    │
│  用户选择: 模型(豆包) + 场景(自媒体/电商/通用)      │
│                    ↓                               │
│  ScenarioRegistry.get(scenario)                    │
│      → 拿到场景预设(扩展字段 + 默认值覆盖)           │
│                    ↓                               │
│  SchemaResolver: baseSchema(后端) + scenarioOverlay│
│                    ↓                               │
│  <NomiSchemaForm schema={resolvedSchema} />        │
│                    ↓                               │
│  提交时：场景参数合并到 prompt_suffix                │
│                    ↓                               │
│  UnifiedParams → IPC → 后端                        │
└────────────────────┬─────────────────────────────┘
                     │ IPC
┌────────────────────┴─────────────────────────────┐
│                    后端                            │
│                                                    │
│  ModelRegistry.lookup(modelName)                   │
│      → ImageAdapter (Strategy)                    │
│          .transform(UnifiedParams → ModelRequest)  │
│          .call(ModelRequest → 外部API)              │
│          .parse(ModelResponse → UnifiedResult)     │
│                                                    │
│  返回统一响应格式                                    │
└──────────────────────────────────────────────────┘
```

### 分工边界

| 层 | 负责 | 不负责 |
|---|------|-------|
| **后端** | 模型注册、参数翻译、API 调用、统一响应 | 行业/场景概念、场景扩展字段 |
| **前端** | 场景注册、表单渲染、prompt 组合、参数校验 | 模型 API 调用细节 |

---

## 三、后端设计

### 3.1 豆包 API 详情

```
模型: doubao-seedream-4.5
端点: https://api.modelverse.cn/v1/images/generations
认证: Authorization: Bearer $MODELVERSE_API_KEY
方法: POST
Content-Type: application/json

请求体:
{
  "model": "doubao-seedream-4.5",
  "prompt": "描述文字",
  "images": ["url1"],              // 可选，图生图
  "size": "2k",                    // 默认 2048x2048，可指定 "2K"/"4K" 或具体像素如 "2304x1728"
  "watermark": false,
  "stream": false,
  "response_format": "url"
}

响应体:
{
  "data": [{ "url": "https://..." }],
  ...
}
```

### 3.2 Crate 目录结构

```
crates/backend/nomifun-image/
├── Cargo.toml
├── src/
│   ├── lib.rs                 ← 模块入口，导出 ServiceBuilder
│   ├── service.rs             ← 生图服务主逻辑（统一入口）
│   ├── models.rs              ← 模型枚举 + Schema 定义
│   ├── schema.rs              ← 参数 Schema 定义（返回给前端动态渲染）
│   ├── adapters/
│   │   ├── mod.rs             ← ImageAdapter trait + ModelRegistry
│   │   └── doubao.rs          ← 豆包适配器
│   ├── routes.rs              ← Axum 路由定义（3个端点）
│   ├── state.rs               ← AppState 注入
│   └── error.rs               ← 统一错误类型
```

**注意：没有 `industries/` 目录了** — 场景由前端管理，后端不关心。

### 3.3 核心 Rust 代码定义

#### ImageAdapter trait (Strategy 模式)

```rust
// src/adapters/mod.rs

use async_trait::async_trait;
use std::collections::HashMap;

/// 统一生图参数 — 前端传过来的
#[derive(Debug, Deserialize)]
pub struct GenerateParams {
    pub prompt: String,
    pub size: Option<String>,          // "2k", "4k", "2304x1728" 等
    pub images: Option<Vec<String>>,   // 图生图 URL 列表
    pub watermark: Option<bool>,
    pub stream: Option<bool>,
    pub response_format: Option<String>,
    /// 额外参数（场景合并后的 prompt_suffix 等）
    pub extra: Option<HashMap<String, serde_json::Value>>,
}

/// 统一生图响应 — 返回给前端的
#[derive(Debug, Serialize)]
pub struct GenerateResult {
    pub image_url: String,
    pub model: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// 模型适配器 trait — Strategy 核心
#[async_trait]
pub trait ImageAdapter: Send + Sync {
    /// 模型名称（如 "doubao-seedream-4.5"）
    fn model_name(&self) -> &str;

    /// 模型显示名称（如 "豆包 Seedream 4.5"）
    fn model_label(&self) -> &str;

    /// 该模型支持的参数 Schema（返回给前端动态渲染表单）
    fn param_schema(&self) -> Vec<SchemaField>;

    /// 该模型的默认参数值
    fn default_params(&self) -> HashMap<String, serde_json::Value>;

    /// 将统一参数翻译成模型原生请求 → 调用 API → 解析响应
    async fn generate(&self, params: GenerateParams, api_key: &str) -> Result<GenerateResult, ImageError>;
}

/// 模型注册表 — Registry 核心
pub struct ModelRegistry {
    adapters: HashMap<String, Box<dyn ImageAdapter>>,
}

impl ModelRegistry {
    pub fn new() -> Self { Self { adapters: HashMap::new() } }

    pub fn register(&mut self, adapter: Box<dyn ImageAdapter>) {
        self.adapters.insert(adapter.model_name().to_string(), adapter);
    }

    pub fn get(&self, model: &str) -> Option<&dyn ImageAdapter> {
        self.adapters.get(model).map(|a| a.as_ref())
    }

    pub fn list_models(&self) -> Vec<ModelInfo> {
        self.adapters.values().map(|a| ModelInfo {
            name: a.model_name().to_string(),
            label: a.model_label().to_string(),
        }).collect()
    }
}
```

#### DoubaoAdapter 实现

```rust
// src/adapters/doubao.rs

use async_trait::async_trait;
use reqwest::Client;

pub struct DoubaoAdapter {
    client: Client,
    endpoint: String,
}

impl DoubaoAdapter {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            endpoint: "https://api.modelverse.cn/v1/images/generations".to_string(),
        }
    }
}

#[async_trait]
impl ImageAdapter for DoubaoAdapter {
    fn model_name(&self) -> &str { "doubao-seedream-4.5" }
    fn model_label(&self) -> &str { "豆包 Seedream 4.5" }

    fn param_schema(&self) -> Vec<SchemaField> {
        vec![
            SchemaField {
                key: "prompt",
                field_type: FieldType::Textarea,
                label: "提示词",
                required: true,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "size",
                field_type: FieldType::Select,
                label: "图片尺寸",
                required: false,
                default_value: Some(serde_json::Value::String("2k")),
                options: Some(vec![
                    SelectOption { value: "2k", label: "2K (2048×2048)" },
                    SelectOption { value: "4k", label: "4K" },
                    SelectOption { value: "2304x1728", label: "2304×1728" },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "images",
                field_type: FieldType::ImageList,
                label: "参考图片（图生图）",
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
        ]
    }

    fn default_params(&self) -> HashMap<String, serde_json::Value> {
        let mut map = HashMap::new();
        map.insert("size".to_string(), serde_json::Value::String("2k"));
        map.insert("watermark".to_string(), serde_json::Value::Bool(false));
        map.insert("stream".to_string(), serde_json::Value::Bool(false));
        map.insert("response_format".to_string(), serde_json::Value::String("url"));
        map
    }

    async fn generate(&self, params: GenerateParams, api_key: &str) -> Result<GenerateResult, ImageError> {
        // 构建请求体
        let mut body = serde_json::json!({
            "model": "doubao-seedream-4.5",
            "prompt": params.prompt,
        });

        if let Some(size) = &params.size {
            body["size"] = serde_json::Value::String(size.clone());
        }
        if let Some(images) = &params.images {
            body["images"] = serde_json::to_value(images)?;
        }
        body["watermark"] = params.watermark.unwrap_or(false);
        body["stream"] = params.stream.unwrap_or(false);
        body["response_format"] = params.response_format.clone()
            .unwrap_or("url".to_string());

        // 调用 API
        let response = self.client
            .post(&self.endpoint)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        // 解析响应
        let result: serde_json::Value = response.json().await?;
        let image_url = result["data"][0]["url"]
            .as_str()
            .ok_or(ImageError::InvalidResponse)?
            .to_string();

        Ok(GenerateResult {
            image_url,
            model: "doubao-seedream-4.5".to_string(),
            metadata: None,
        })
    }
}
```

#### ImageService 统一入口

```rust
// src/service.rs

pub struct ImageService {
    registry: ModelRegistry,
}

impl ImageService {
    pub fn new() -> Self {
        let mut registry = ModelRegistry::new();
        registry.register(Box::new(DoubaoAdapter::new()));
        // 后续新增模型只需在此注册
        Self { registry }
    }

    /// 获取模型列表
    pub fn list_models(&self) -> Vec<ModelInfo> {
        self.registry.list_models()
    }

    /// 获取指定模型的参数 Schema
    pub fn get_schema(&self, model: &str) -> Option<Vec<SchemaField>> {
        self.registry.get(model).map(|a| a.param_schema())
    }

    /// 获取指定模型的默认参数
    pub fn get_defaults(&self, model: &str) -> Option<HashMap<String, serde_json::Value>> {
        self.registry.get(model).map(|a| a.default_params())
    }

    /// 统一生图入口
    pub async fn generate(&self, model: &str, params: GenerateParams, api_key: &str) -> Result<GenerateResult, ImageError> {
        let adapter = self.registry.get(model)
            .ok_or(ImageError::ModelNotFound(model.to_string()))?;
        adapter.generate(params, api_key).await
    }
}
```

### 3.4 IPC 接口定义（后端 3 个端点）

```
1. list_models
   GET /api/image/models
   → 返回 [{ name, label }] 模型列表

2. get_schema
   GET /api/image/schema?model=doubao-seedream-4.5
   → 返回 { fields: [...], defaultValues: {...} } 参数 Schema

3. generate
   POST /api/image/generate
   Body: { model: "doubao-seedream-4.5", params: { prompt, size, images, ... } }
   → 返回 { imageUrl, model, metadata } 统一结果
```

**注意：没有 `list_industries` 端点了** — 行业/场景由前端管理。

### 3.5 ServiceBuilder 注入（遵循现有模式）

```rust
// src/lib.rs

pub struct ImageServiceBuilder {
    // 和 nomifun-requirement / nomifun-knowledge 一样的 ServiceBuilder 模式
}

impl ImageServiceBuilder {
    pub fn build(self) -> ImageService { ... }
}
```

---

## 四、前端设计

### 4.1 场景注册（前端管理）

```typescript
// ui/src/renderer/services/imageScenarios.ts

interface ScenarioConfig {
  name: string;          // 场景标识
  label: string;         // 场景显示名
  extraFields: SchemaField[];       // 场景扩展参数
  paramOverrides: Record<string, any>;  // 默认值覆盖
  promptSuffixTemplate?: string;    // prompt 后缀模板
}

const scenarioRegistry: Record<string, ScenarioConfig> = {
  general: {
    name: "general",
    label: "通用",
    extraFields: [],
    paramOverrides: {},
    promptSuffixTemplate: undefined,
  },
  social_media: {
    name: "social_media",
    label: "自媒体",
    extraFields: [
      { key: "platform", type: "select", label: "目标平台",
        options: [{ value: "小红书", label: "小红书" }, { value: "抖音", label: "抖音" }, { value: "微博", label: "微博" }] },
      { key: "brandColor", type: "color", label: "品牌色" },
      { key: "contentType", type: "select", label: "内容类型",
        options: [{ value: "封面图", label: "封面图" }, { value: "海报", label: "海报" }, { value: "配图", label: "配图" }] },
    ],
    paramOverrides: { size: "2k" }, // 自媒体默认 2K
    promptSuffixTemplate: "适合{{platform}}平台，{{contentType}}风格",
  },
  ecommerce: {
    name: "ecommerce",
    label: "电商",
    extraFields: [
      { key: "productType", type: "select", label: "商品类型",
        options: [{ value: "服装", label: "服装" }, { value: "数码", label: "数码" }, { value: "食品", label: "食品" }] },
      { key: "imageUsage", type: "select", label: "图片用途",
        options: [{ value: "主图", label: "主图" }, { value: "详情图", label: "详情图" }] },
      { key: "whiteBackground", type: "toggle", label: "白底图" },
    ],
    paramOverrides: { size: "2k" },
    promptSuffixTemplate: "{{productType}}商品{{imageUsage}}，{{whiteBackground ? '白底' : '场景'}}拍摄",
  },
  education: {
    name: "education",
    label: "教育",
    extraFields: [
      { key: "diagramType", type: "select", label: "图解类型",
        options: [{ value: "思维导图", label: "思维导图" }, { value: "流程图", label: "流程图" }, { value: "示意图", label: "示意图" }] },
    ],
    paramOverrides: {},
    promptSuffixTemplate: "教育图解，{{diagramType}}风格",
  },
};

export function getScenario(name: string): ScenarioConfig {
  return scenarioRegistry[name] || scenarioRegistry.general;
}

export function listScenarios(): ScenarioConfig[] {
  return Object.values(scenarioRegistry);
}

/** 合并模型 Schema + 场景 Overlay → 最终渲染 Schema */
export function resolveSchema(
  baseSchema: SchemaField[],
  scenario: ScenarioConfig
): { fields: SchemaField[]; defaults: Record<string, any> } {
  const fields = [...baseSchema, ...scenario.extraFields];
  const defaults = scenario.paramOverrides; // 场景覆盖模型默认值
  return { fields, defaults };
}

/** 将场景参数合并到 prompt */
export function buildPrompt(
  basePrompt: string,
  scenario: ScenarioConfig,
  scenarioParams: Record<string, any>
): string {
  if (!scenario.promptSuffixTemplate) return basePrompt;

  let suffix = scenario.promptSuffixTemplate;
  for (const [key, value] of Object.entries(scenarioParams)) {
    suffix = suffix.replace(`{{${key}}}`, String(value));
  }
  return `${basePrompt}, ${suffix}`;
}
```

### 4.2 IPC 桥接注册（遵循 ipcBridge 三层桥接模式）

```typescript
// ui/src/common/types/image.ts — TypeScript 类型定义

export interface ModelInfo {
  name: string;
  label: string;
}

export interface SchemaField {
  key: string;
  type: "textarea" | "select" | "slider" | "color" | "toggle" | "imageList" | "number" | "text";
  label: string;
  required: boolean;
  default_value?: any;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

export interface GenerateParams {
  prompt: string;
  size?: string;
  images?: string[];
  watermark?: boolean;
  stream?: boolean;
  response_format?: string;
  extra?: Record<string, any>;
}

export interface GenerateResult {
  imageUrl: string;
  model: string;
  metadata?: Record<string, any>;
}

// ui/src/common/adapter/ipcBridge.ts — 注册 image 命名空间
// 在现有 ipcBridge 中添加：
export const imageBridge = {
  listModels: () => invoke<ModelInfo[]>("image_list_models"),
  getSchema: (model: string) => invoke<{ fields: SchemaField[]; defaultValues: Record<string, any> }>("image_get_schema", { model }),
  generate: (params: GenerateParams & { model: string }) => invoke<GenerateResult>("image_generate", params),
};
```

### 4.3 NomiSchemaForm 动态表单组件（Schema-driven 核心）

```typescript
// ui/src/renderer/components/NomiSchemaForm/index.tsx

interface NomiSchemaFormProps {
  schema: SchemaField[];
  defaults?: Record<string, any>;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}

/** Schema 驱动的动态表单 — 一个组件覆盖所有模型×场景组合 */
export function NomiSchemaForm({ schema, defaults, values, onChange }: NomiSchemaFormProps) {
  const mergedValues = { ...defaults, ...values };

  const handleChange = (key: string, value: any) => {
    onChange({ ...mergedValues, [key]: value });
  };

  return (
    <div className={styles.form}>
      {schema.map((field) => (
        <div key={field.key} className={styles.field}>
          <label>{field.label}</label>
          <SchemaFieldRenderer
            field={field}
            value={mergedValues[field.key]}
            onChange={(v) => handleChange(field.key, v)}
          />
        </div>
      ))}
    </div>
  );
}
```

字段类型组件目录：

```
ui/src/renderer/components/NomiSchemaForm/
├── index.tsx                    ← 主组件
├── NomiSchemaForm.module.css   ← CSS 模块
├── SchemaFieldRenderer.tsx     ← 字段路由器（按 type 渲染对应组件）
├── fields/
│   ├── TextField.tsx
│   ├── TextAreaField.tsx
│   ├── SliderField.tsx
│   ├── SelectField.tsx
│   ├── ColorField.tsx
│   ├── ToggleField.tsx
│   ├── ImageListField.tsx
│   └── NumberField.tsx
```

### 4.4 生图页面流程

```
用户进入生图页面
  │
  ├─ 1. 调 imageBridge.listModels() → 获取模型列表
  ├─ 2. 调 listScenarios() → 获取场景列表（前端本地）
  ├─ 3. 用户选择模型 + 场景
  │
  ├─ 4. 调 imageBridge.getSchema(model) → 获取模型 baseSchema
  ├─ 5. resolveSchema(baseSchema, scenario) → 合成最终 Schema
  │
  ├─ 6. <NomiSchemaForm schema={resolvedSchema} /> → 动态渲染表单
  │
  ├─ 7. 用户填写参数，点击生成
  │
  ├─ 8. 前端处理：
  │     ├─ 分离场景参数 和 模型参数
  │     ├─ buildPrompt(basePrompt, scenario, scenarioParams) → 合成最终 prompt
  │     └─ 合成 GenerateParams（只传模型相关的参数 + 合成的 prompt）
  │
  ├─ 9. 调 imageBridge.generate(params) → 后端路由到对应 Adapter
  │
  └─ 10. 展示结果图片
```

### 4.5 前端页面目录

```
ui/src/renderer/pages/imageGeneration/
├── index.tsx                          ← 主页面（模型+场景选择 + 动态表单 + 结果展示）
├── ImageGeneration.module.css         ← 页面样式
```

### 4.6 样式规范（遵循项目三层体系）

- **UnoCSS 工具类**：布局、间距、响应式等原子类
- **CSS 自定义属性**：组件级主题色、字号等
- **Arco Design 覆盖**：复用 Arco 组件（Select、Slider 等），必要时用 `:global` 覆盖
- **CSS 模块**：每个组件独立 `.module.css`，避免样式冲突

---

## 五、场景参数如何影响生图

场景参数不直接传给后端模型 API，而是通过 **prompt 后缀** 方式融合：

```
用户输入 prompt: "一只可爱的龙虾"
场景选择: 自媒体
场景参数: { platform: "小红书", contentType: "封面图", brandColor: "#FF4444" }

前端合并后的 prompt:
"一只可爱的龙虾, 适合小红书平台，封面图风格"

→ 这个合并后的 prompt 传给后端 → 后端直接传给豆包 API
```

场景的其他参数（如 `brandColor`）可以：
- 合并到 prompt 文字里（"品牌色为红色"）
- 或者作为 metadata 存储，不影响 API 调用
- 后续模型支持颜色参数时，再映射到模型原生字段

---

## 六、API Key 管理

复用现有 configService，和 LLM Provider 配置方式一致：

```
Settings 页面新增: MODELVERSE_API_KEY 配置项
存储路径: configService.get("image_api_key")
前端从 configService 读取 → IPC 传递给后端 → 后端用 Bearer 认证
```

---

## 七、扩展步骤

### 新增模型（3步，只改后端）

1. 在 `src/adapters/` 下新建 `xxx.rs`，实现 `ImageAdapter` trait
2. 在 `service.rs` 的 `ImageService::new()` 中注册新 Adapter
3. 前端零改动 — `listModels` 自动返回新模型，`NomiSchemaForm` 自动适配新 Schema

### 新增场景（3步，只改前端）

1. 在 `imageScenarios.ts` 中新增一个 `ScenarioConfig`
2. 前端零改动其他 — 场景列表自动更新，表单自动渲染新字段
3. 后端零改动 — 场景参数最终都合并到 prompt 里

---

## 八、待执行步骤

### Step 1: 创建后端 crate `nomifun-image`

**新建文件:**
- `crates/backend/nomifun-image/Cargo.toml`
- `crates/backend/nomifun-image/src/lib.rs`
- `crates/backend/nomifun-image/src/service.rs`
- `crates/backend/nomifun-image/src/models.rs`
- `crates/backend/nomifun-image/src/schema.rs`
- `crates/backend/nomifun-image/src/adapters/mod.rs`
- `crates/backend/nomifun-image/src/adapters/doubao.rs`
- `crates/backend/nomifun-image/src/routes.rs`
- `crates/backend/nomifun-image/src/state.rs`
- `crates/backend/nomifun-image/src/error.rs`

**修改文件:**
- `Cargo.toml`（workspace）— 添加 nomifun-image member
- `crates/backend/nomifun-gateway/src/routes.rs` — 合并 image_routes()
- `apps/src/main.rs` — 注入 ImageServiceBuilder

### Step 2: 前端 IPC 桥接注册

**修改文件:**
- `ui/src/common/adapter/ipcBridge.ts` — 注册 image 命名空间

**新建文件:**
- `ui/src/common/types/image.ts` — 类型定义

### Step 3: 前端场景注册

**新建文件:**
- `ui/src/renderer/services/imageScenarios.ts` — ScenarioConfig 定义 + Registry

### Step 4: 前端 NomiSchemaForm 组件

**新建文件:**
- `ui/src/renderer/components/NomiSchemaForm/index.tsx`
- `ui/src/renderer/components/NomiSchemaForm/NomiSchemaForm.module.css`
- `ui/src/renderer/components/NomiSchemaForm/SchemaFieldRenderer.tsx`
- `ui/src/renderer/components/NomiSchemaForm/fields/` 下 8 个文件

### Step 5: 前端生图页面

**新建文件:**
- `ui/src/renderer/pages/imageGeneration/index.tsx`
- `ui/src/renderer/pages/imageGeneration/ImageGeneration.module.css`

**修改文件:**
- `ui/src/renderer/components/layout/Router.tsx` — 注册路由

### Step 6: API Key 配置

**修改文件:**
- Settings 页面新增 MODELVERSE_API_KEY 配置项

### Step 7: 测试验证

- 后端编译通过 + cargo test
- 前端编译通过 + 页面渲染验证
- 模型列表 + Schema 接口测试
- 豆包生图联调（需要真实 API Key）

---

## 九、开发完成后的产物

开发完成后再创建模块文档 `helloagents/modules/image-module-design.md`，记录：
- 实际实现的代码结构
- 遇到的问题和解决方案
- 和计划的偏差
- 后续扩展指南
