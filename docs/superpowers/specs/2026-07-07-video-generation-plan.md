# Video Generation Implementation Plan

Design spec: `docs/superpowers/specs/2026-07-07-video-generation-design.md`

## Step 1: Create `nomifun-video` crate skeleton

**Files to create:**
- `crates/backend/nomifun-video/Cargo.toml` — copy deps from `nomifun-image/Cargo.toml` (same set: nomifun-common, nomifun-api-types, nomifun-auth, axum, tokio, serde, serde_json, async-trait, reqwest, tracing)
- `crates/backend/nomifun-video/src/lib.rs` — module declarations + re-exports (`video_routes`, `VideoService`, `VideoRouterState`)
- `crates/backend/nomifun-video/src/state.rs` — `VideoRouterState { video_service: Arc<VideoService> }` (mirror ImageRouterState)
- `crates/backend/nomifun-video/src/schema.rs` — reuse `FieldType`, `SelectOption`, `SchemaField`, `SchemaResponse` from nomifun-image (identical structures; video adds no new field types)

**Workspace wiring:**
- Add `nomifun-video = { path = "crates/backend/nomifun-video" }` to `[workspace.dependencies]` in root `Cargo.toml`

**Verification:** `cargo check -p nomifun-video` compiles (with empty stubs)

---

## Step 2: Define models (DTOs)

**File:** `crates/backend/nomifun-video/src/models.rs`

Types to define (all `#[serde(rename_all = "camelCase")]`):

- `VideoSubmitRequest` — `model: String`, `api_key: String`, `prompt: String`, `duration: Option<u32>`, `model_params: serde_json::Value`
- `VideoSubmitResult` — `task_id: String`, `request_id: Option<String>`
- `VideoTaskStatus` — `task_id: String`, `task_status: String`, `urls: Option<Vec<String>>`, `submit_time: Option<i64>`, `finish_time: Option<i64>`, `error_message: Option<String>`, `duration: Option<u32>`, `request_id: Option<String>`
- `VideoModelInfo` — `name: String`, `label: String`

**Verification:** `cargo check -p nomifun-video`

---

## Step 3: Define VideoAdapter trait + ModelRegistry

**File:** `crates/backend/nomifun-video/src/adapters/mod.rs`

```rust
#[async_trait]
pub trait VideoAdapter: Send + Sync {
    fn model_name(&self) -> &str;
    fn model_label(&self) -> &str;
    fn param_schema(&self) -> Vec<SchemaField>;
    fn default_params(&self) -> HashMap<String, serde_json::Value>;

    async fn submit(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        prompt: &str,
        duration: Option<u32>,
        model_params: &Value,
    ) -> Result<String, AppError>;  // Returns task_id

    async fn query_status(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        task_id: &str,
    ) -> Result<VideoTaskStatus, AppError>;
}
```

`ModelRegistry` — same structure as image's: `HashMap<String, Box<dyn VideoAdapter>>`, with `new()`, `register()`, `get()`, `list_models()`, `get_schema_response()`.

Add a shared helper function for `query_status()` since both models use the same endpoint:

```rust
pub async fn query_task_status(
    client: &reqwest::Client,
    api_key: &str,
    task_id: &str,
) -> Result<VideoTaskStatus, AppError> {
    // GET https://api.modelverse.cn/v1/tasks/status?task_id=<task_id>
    // Parse response into VideoTaskStatus
}
```

Both adapters will delegate `query_status()` to this shared function.

**Verification:** `cargo check -p nomifun-video`

---

## Step 4: Implement DoubaoAdapter

**File:** `crates/backend/nomifun-video/src/adapters/doubao.rs`

- Constants: `SUBMIT_ENDPOINT = "https://api.modelverse.cn/v1/tasks/submit"`
- `model_name()` → `"doubao-seedance-2-0-260128"`
- `model_label()` → `"豆包 Seedance 2.0"`
- `param_schema()` — returns SchemaField[] for all doubao-specific params:
  - `first_frame_image` (ImageUpload, optional) — 首帧图片
  - `last_frame_image` (ImageUpload, optional) — 尾帧图片
  - `reference_image` (ImageUpload, optional) — 参考图片
  - `reference_video` (Text, optional) — 参考视频 URL
  - `reference_audio` (Text, optional) — 参考音频 URL
  - `resolution` (Select: 480p/720p/1080p/4K, optional) — 分辨率
  - `ratio` (Select: 16:9/4:3/1:1/3:4/9:16/21:9/adaptive, optional) — 宽高比
  - `generate_audio` (Toggle, optional) — 生成声音
  - `camera_fixed` (Toggle, optional) — 固定摄像头
  - `watermark` (Toggle, optional, default false) — 水印
  - `seed` (Number, optional, min 0, max 2147483647) — 随机种子
- `default_params()` — duration=5, ratio="adaptive", resolution="720p", generate_audio=false, camera_fixed=false, watermark=false
- `submit()` — builds the doubao-native request body:
  - `input.content[]` array from prompt + images/video/audio
  - `parameters` from model_params
  - Sends POST to SUBMIT_ENDPOINT with Bearer auth
  - Returns task_id from `output.task_id`
- `query_status()` — delegates to shared `query_task_status()`

Also register the mini variant: add a second `DoubaoAdapter` constructor or register two instances (model names `doubao-seedance-2-0-260128` and `doubao-seedance-2-0-mini-260615`).

**Verification:** `cargo check -p nomifun-video`

---

## Step 5: Implement KlingAdapter

**File:** `crates/backend/nomifun-video/src/adapters/kling.rs`

- Constants: `SUBMIT_ENDPOINT = "https://api.modelverse.cn/v1/tasks/submit"` (same endpoint)
- `model_name()` → `"kling-v3"`
- `model_label()` → `"可灵 V3"`
- `param_schema()` — returns SchemaField[] for all kling-specific params:
  - `kling_v3_type` (Select: t2v/i2v/motion_control, optional) — 生成模式
  - `negative_prompt` (Textarea, optional) — 反向提示词
  - `image` (ImageUpload, optional) — 首帧图片
  - `image_tail` (ImageUpload, optional) — 尾帧图片
  - `img_url` (ImageUpload, optional) — 参考图片(motion_control)
  - `video_url` (Text, optional) — 参考视频URL(motion_control)
  - `character_orientation` (Select: image/video, optional) — 角色朝向
  - `keep_original_sound` (Select: yes/no, optional) — 保留原声
  - `mode` (Select: std/pro, optional) — 生成模式
  - `aspect_ratio` (Select: 16:9/9:16/1:1, optional) — 宽高比
  - `sound` (Select: on/off, optional) — 声音
  - `watermark_enabled` (Toggle, optional, default false) — 水印
  - `multi_shot` (Toggle, optional) — 多镜头
  - `shot_type` (Text, optional) — 镜头类型
  - `multi_prompt` (Text, optional) — 多镜头提示词 (JSON array as text for now)
- `default_params()` — duration=5, mode="std", aspect_ratio="16:9", sound="off", watermark_enabled=false
- `submit()` — builds the kling-native request body:
  - `input.prompt` / `input.negative_prompt` / `input.img_url` / `input.video_url`
  - `parameters.*` from model_params
  - Auto-derive `kling_v3_type` if not explicitly set
  - Sends POST to SUBMIT_ENDPOINT with Bearer auth
  - Returns task_id from `output.task_id`
- `query_status()` — delegates to shared `query_task_status()`

**Verification:** `cargo check -p nomifun-video`

---

## Step 6: Implement VideoService

**File:** `crates/backend/nomifun-video/src/service.rs`

Mirror ImageService structure:
- `VideoService` owns `Arc<ModelRegistry>`
- Constructor: create registry, register `DoubaoAdapter` (both variants) + `KlingAdapter`
- Methods:
  - `list_models()` → delegate to registry
  - `get_schema(model)` → delegate to registry
  - `submit(model, api_key, prompt, duration, model_params)` → lookup adapter, call `adapter.submit(client, ...)`
  - `query_status(model, api_key, task_id)` → since query_status is the same for both, just call shared helper directly (no need to route by model, but keep routing for future extensibility)

**Verification:** `cargo check -p nomifun-video`

---

## Step 7: Implement routes

**File:** `crates/backend/nomifun-video/src/routes.rs`

4 routes on `VideoRouterState`:
- `GET /api/video/models` — list models
- `GET /api/video/schema?model=...` — get param schema
- `POST /api/video/submit` — submit task
- `GET /api/video/status?task_id=...&api_key=...` — query status (api_key as query param since GET)

All routes require `Extension<CurrentUser>` (auth middleware). All responses wrapped in `ApiResponse::ok(...)`.

Note: For `GET /api/video/status`, the api_key is needed but GET doesn't take a body. Options:
- Pass as query param `?task_id=xxx&api_key=xxx` (simplest, matches the pattern)
- This is acceptable since these are local-only requests (desktop app, loopback)

**Verification:** `cargo check -p nomifun-video`

---

## Step 8: Wire into nomifun-app

**Files to modify:**

1. `Cargo.toml` (root) — add `nomifun-video = { path = "crates/backend/nomifun-video" }` to `[workspace.dependencies]`

2. `crates/backend/nomifun-app/Cargo.toml` — add `nomifun-video.workspace = true`

3. `crates/backend/nomifun-app/src/router/state.rs`:
   - Add `use nomifun_video::{VideoRouterState, VideoService};`
   - Add `pub video: VideoRouterState` field to `ModuleStates`
   - In `build_module_states`: add `video: VideoRouterState { video_service: std::sync::Arc::new(VideoService::new()) }`

4. `crates/backend/nomifun-app/src/router/routes.rs`:
   - Add `use nomifun_video::video_routes;`
   - Add video route group: `let video_authenticated = video_routes(states.video).route_layer(from_fn_with_state(auth_mw_state.clone(), auth_middleware));`
   - Merge: `.merge(video_authenticated)`

**Verification:** `cargo check -p nomifun-app`

---

## Step 9: Frontend TypeScript types

**File:** `ui/src/common/types/video.ts`

Define:
- `IVideoModelInfo` — { name, label }
- `IVideoSchemaField` — reuse from existing `ISchemaField` type in ipcBridge (same shape)
- `IVideoSchemaResponse` — { fields, defaultValues }
- `IVideoSubmitRequest` — { model, apiKey, prompt, duration?, modelParams }
- `IVideoSubmitResult` — { taskId, requestId? }
- `IVideoTaskStatus` — { taskId, taskStatus, urls?, submitTime?, finishTime?, errorMessage?, duration?, requestId? }

**Verification:** TypeScript compiles (tsc --noEmit, but this project doesn't enforce it)

---

## Step 10: Frontend ipcBridge + API

**File:** `ui/src/common/adapter/ipcBridge.ts`

Add `video` namespace:
```typescript
video: {
  listModels: httpGet<IVideoModelInfo[], void>('/api/video/models'),
  getSchema: httpGet<IVideoSchemaResponse, { model: string }>(
    (p) => `/api/video/schema?model=${encodeURIComponent(p.model)}`
  ),
  submit: httpPost<IVideoSubmitResult, IVideoSubmitRequest>('/api/video/submit', (p) => p),
  getStatus: httpGet<IVideoTaskStatus, { task_id: string; api_key: string }>(
    (p) => `/api/video/status?task_id=${encodeURIComponent(p.task_id)}&api_key=${encodeURIComponent(p.api_key)}`
  ),
}
```

**Verification:** Build compiles

---

## Step 11: Frontend video generation page

**Files to create:**

- `ui/src/renderer/pages/videoGeneration/index.tsx` — main page component

Key behavior (mirroring imageGeneration):
1. On mount: fetch models via `ipcBridge.video.listModels.invoke()`
2. On model select: fetch schema via `ipcBridge.video.getSchema.invoke({ model })`
3. Render form via existing `NomiSchemaForm` component (reuse!)
4. API key input with localStorage (`nomifun:video:modelverse-api-key`)
5. On submit: call `ipcBridge.video.submit.invoke({ model, apiKey, prompt, duration, modelParams })`
6. Task list: maintain in component state, poll `ipcBridge.video.getStatus.invoke(...)` every 10s for Pending/Running tasks
7. Video preview: render `<video>` tag when status is Success

Page layout:
- Left: model selector + dynamic form (NomiSchemaForm)
- Right: task list with status + video preview

**Verification:** App loads, page renders

---

## Step 12: Frontend routing + sidebar

**Files to modify:**

1. `ui/src/renderer/components/layout/Router.tsx`:
   - Add lazy import: `const VideoGenerationPage = React.lazy(() => import('@renderer/pages/videoGeneration'));`
   - Add route: `<Route path='/video-generation' element={withRouteFallback(VideoGenerationPage)} />`

2. `ui/src/renderer/components/layout/Sider/index.tsx`:
   - Add click handler for video generation navigation
   - Add sidebar icon/entry (place next to image generation)

3. Create `ui/src/renderer/components/layout/Sider/SiderNav/SiderVideoGenerationEntry.tsx` — mirror SiderImageGenerationEntry

**Verification:** Sidebar shows entry, clicking navigates to /video-generation, page renders

---

## Step 13: i18n keys

**Files to modify:**

- `ui/src/locales/zh-CN.ts` — add `videoGeneration.title: '视频生成'` and other labels
- `ui/src/locales/en-US.ts` — add `videoGeneration.title: 'Video Generation'` and other labels

**Verification:** Labels display correctly in both languages

---

## Step 14: End-to-end smoke test

Manual verification:
1. Open the app → sidebar shows "视频生成" entry
2. Click → page loads with model selector
3. Select a model → form renders with correct fields
4. Enter API key → persists to localStorage
5. Fill in prompt → submit → task appears in task list as Pending
6. Polling updates status to Running → Success
7. Video URL shows → click to play in `<video>` tag
8. Switch models → form changes accordingly
9. Error case: invalid API key → error message displayed

---

## Dependency chain

```
Step 1 (skeleton) → Step 2 (models) → Step 3 (trait+registry) → Step 4 (doubao) → Step 5 (kling)
                   → Step 6 (service) → Step 7 (routes) → Step 8 (wire into nomifun-app)

Step 9 (TS types) → Step 10 (ipcBridge) → Step 11 (page) → Step 12 (routing+sidebar) → Step 13 (i18n) → Step 14 (smoke test)

Backend (Steps 1-8) and frontend (Steps 9-13) are independent and can be done in parallel.
```
