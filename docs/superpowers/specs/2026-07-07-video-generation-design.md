# AI Video Generation Feature Design

## Overview

Add AI video generation capability to nomifun-tauri, supporting two models: doubao-seedance-2-0 and kling-v3. Both models are accessed via the modelverse platform. The feature follows the existing Adapter + Registry pattern established by `nomifun-image`.

## Key Decisions

- **No database**: Task state is not persisted server-side. Frontend manages task list in memory.
- **API key from frontend**: Passed per-request, stored in localStorage.
- **No callback in v1**: The `callback_url` feature is deferred. Frontend uses polling to check task status.
- **Schema-driven forms**: Backend returns parameter schemas per model; frontend renders forms dynamically.
- **Model-specific params**: Each model defines its own parameter structure under `model_params`, avoiding a monolithic union type.

## Unified API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/video/models` | Returns model list + parameter schemas |
| POST | `/api/video/submit` | Submit a video generation task |
| GET | `/api/video/status?task_id=xxx` | Query task status |

### Request / Response Types

**VideoSubmitRequest**

```rust
struct VideoSubmitRequest {
    model: String,              // e.g. "doubao-seedance-2-0-260128", "kling-v3"
    api_key: String,            // Frontend-provided API key
    prompt: String,             // Text prompt (required except motion_control)
    duration: Option<u32>,      // Video duration in seconds
    model_params: Value,        // Model-specific parameters (JSON)
}
```

**VideoTaskStatus**

```rust
struct VideoTaskStatus {
    task_id: String,
    task_status: VideoTaskStatusEnum,  // Pending, Running, Success, Failure, Expired
    urls: Option<Vec<String>>,         // Result video URLs
    submit_time: Option<i64>,
    finish_time: Option<i64>,
    error_message: Option<String>,
    duration: Option<u32>,
    request_id: Option<String>,
}

enum VideoTaskStatusEnum {
    Pending,
    Running,
    Success,
    Failure,
    Expired,  // Only doubao
}
```

**VideoModelInfo** (returned by GET /api/video/models)

```rust
struct VideoModelInfo {
    name: String,               // Model identifier
    label: String,              // Human-readable name
    param_schema: Vec<FormField>,  // Dynamic form schema for frontend
    default_params: Value,      // Default parameter values
}
```

### FormField Schema

```rust
struct FormField {
    key: String,                // Field name (maps to model_params key)
    label: String,              // Display label
    field_type: FormFieldType,  // Input type
    required: Option<bool>,
    default: Option<Value>,
    options: Option<Vec<SelectOption>>,  // For select type
    min: Option<f64>,           // For number type
    max: Option<f64>,
    description: Option<String>, // Help text
}

enum FormFieldType {
    Text,
    Textarea,
    Select,
    Number,
    Switch,
    ImageUpload,
}

struct SelectOption {
    label: String,
    value: String,
}
```

## Model-Specific Parameters

### DoubaoParams (model_params when model is doubao-*)

```rust
struct DoubaoParams {
    // Image input
    first_frame_image: Option<String>,   // URL or Base64
    last_frame_image: Option<String>,    // URL or Base64
    reference_image: Option<String>,     // URL or Base64

    // Video input
    reference_video: Option<String>,     // URL

    // Audio input
    reference_audio: Option<String>,     // URL

    // Generation parameters
    resolution: Option<DoubaoResolution>,  // 480p, 720p, 1080p, 4K
    ratio: Option<DoubaoRatio>,            // 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, adaptive
    generate_audio: Option<bool>,
    camera_fixed: Option<bool>,
    watermark: Option<bool>,
    seed: Option<u32>,                     // [0, 2147483647]
}
```

Doubao resolution constraints:
- `doubao-seedance-2-0-260128`: supports 480p, 720p, 1080p, 4K
- `doubao-seedance-2-0-mini-260615`: supports 480p, 720p
- Sample video mode only supports 480p

Doubao duration: 4–15 seconds, default 5.

### KlingParams (model_params when model is kling-v3)

```rust
struct KlingParams {
    // Mode (auto-derived if not specified)
    kling_v3_type: Option<KlingV3Type>,  // t2v, i2v, motion_control

    // Negative prompt
    negative_prompt: Option<String>,

    // Image input (t2v / i2v)
    image: Option<String>,               // First frame, URL or Base64
    image_tail: Option<String>,          // Last frame, URL or Base64

    // Motion control
    img_url: Option<String>,             // Reference image (motion_control)
    video_url: Option<String>,           // Reference video (motion_control)
    character_orientation: Option<KlingOrientation>,  // image, video
    keep_original_sound: Option<KlingSound>,          // yes, no

    // Generation parameters
    mode: Option<KlingMode>,             // std (720P), pro (1080P)
    aspect_ratio: Option<KlingAspectRatio>, // 16:9, 9:16, 1:1
    sound: Option<KlingSoundSwitch>,     // on, off
    watermark_enabled: Option<bool>,

    // Multi-shot (t2v only)
    multi_shot: Option<bool>,
    shot_type: Option<String>,
    multi_prompt: Option<Vec<MultiShotSegment>>,
}

struct MultiShotSegment {
    index: u32,
    prompt: String,
    duration: String,
}
```

Kling mode derivation (when `kling_v3_type` is not explicitly set):
1. `video_url` is present → `motion_control`
2. `image` or `img_url` is present → `i2v`
3. Otherwise → `t2v`

Kling duration: t2v/i2v 3–15s, motion_control 5 or 10s, default 5.

## Adapter Trait

```rust
#[async_trait]
trait VideoAdapter: Send + Sync {
    fn model_name(&self) -> &str;
    fn model_label(&self) -> &str;
    fn param_schema(&self) -> Vec<FormField>;
    fn default_params(&self) -> Value;

    async fn submit(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        prompt: &str,
        duration: Option<u32>,
        model_params: &Value,
    ) -> Result<String>;  // Returns task_id

    async fn query_status(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        task_id: &str,
    ) -> Result<VideoTaskStatus>;
}
```

Both adapters share the same modelverse endpoints:
- Submit: `POST https://api.modelverse.cn/v1/tasks/submit`
- Query: `GET https://api.modelverse.cn/v1/tasks/status?task_id=<task_id>`

`query_status()` logic is identical for both models. A shared helper function will handle the common query logic.

## Adapter Parameter Mapping

### DoubaoAdapter: submit() mapping

| Unified field | Doubao native format |
|---------------|---------------------|
| `prompt` | `input.content[{ type: "text", text: prompt }]` |
| `model_params.first_frame_image` | `input.content[{ type: "image_url", image_url: { url: ... }, role: "first_frame" }]` |
| `model_params.last_frame_image` | `input.content[{ type: "image_url", image_url: { url: ... }, role: "last_frame" }]` |
| `model_params.reference_image` | `input.content[{ type: "image_url", image_url: { url: ... }, role: "reference_image" }]` |
| `model_params.reference_video` | `input.content[{ type: "video_url", video_url: { url: ... }, role: "reference_video" }]` |
| `model_params.reference_audio` | `input.content[{ type: "audio_url", audio_url: { url: ... }, role: "reference_audio" }]` |
| `model_params.generate_audio` | `parameters.generate_audio` |
| `model_params.duration` | `parameters.duration` |
| `model_params.resolution` | `parameters.resolution` |
| `model_params.ratio` | `parameters.ratio` |
| `model_params.watermark` | `parameters.watermark` |
| `model_params.seed` | `parameters.seed` |
| `model_params.camera_fixed` | `parameters.camera_fixed` |
| (unified) `duration` | `parameters.duration` (model_params.duration takes precedence) |

### KlingAdapter: submit() mapping

| Unified field | Kling native format |
|---------------|-------------------|
| `prompt` | `input.prompt` |
| `model_params.negative_prompt` | `input.negative_prompt` |
| `model_params.kling_v3_type` | `parameters.kling_v3_type` (or auto-derived) |
| `model_params.image` | `parameters.image` |
| `model_params.image_tail` | `parameters.image_tail` |
| `model_params.img_url` | `input.img_url` (motion_control) |
| `model_params.video_url` | `input.video_url` (motion_control) |
| `model_params.character_orientation` | `parameters.character_orientation` |
| `model_params.keep_original_sound` | `parameters.keep_original_sound` |
| `model_params.mode` | `parameters.mode` |
| `model_params.aspect_ratio` | `parameters.aspect_ratio` |
| `model_params.sound` | `parameters.sound` |
| `model_params.watermark_enabled` | `parameters.watermark_enabled` |
| `model_params.multi_shot` | `parameters.multi_shot` |
| `model_params.shot_type` | `parameters.shot_type` |
| `model_params.multi_prompt` | `parameters.multi_prompt` |
| (unified) `duration` | `parameters.duration` (model_params.duration takes precedence) |

## Backend Crate Structure

```
crates/backend/nomifun-video/
├── Cargo.toml
├── src/
│   ├── lib.rs           # re-exports
│   ├── models.rs        # Unified request/response DTOs
│   ├── adapters/
│   │   ├── mod.rs       # VideoAdapter trait + VideoModelRegistry
│   │   ├── doubao.rs    # doubao-seedance adapter
│   │   └── kling.rs     # kling-v3 adapter
│   ├── schema.rs        # FormField, FormFieldType, SelectOption
│   ├── service.rs       # VideoService (holds Registry, routes requests)
│   ├── routes.rs        # Axum routes
│   └── state.rs         # VideoRouterState
```

## Integration into nomifun-app

Following the same pattern as nomifun-image:

1. Add `nomifun-video` dependency in `nomifun-app/Cargo.toml`
2. Add `video: VideoRouterState` field to `ModuleStates` in `router/state.rs`
3. Add `/api/video/*` route in `router/routes.rs` with auth middleware
4. Construct `VideoService` and register doubao/kling adapters in `services.rs`

## Frontend Architecture

### Page Structure

```
ui/src/renderer/pages/videoGeneration/
├── index.tsx                  # Route component
├── VideoGeneration.tsx        # Main page layout
├── components/
│   ├── ModelSelector.tsx      # Model selection dropdown
│   ├── VideoForm.tsx          # Dynamic form (renders from schema)
│   ├── VideoTaskList.tsx      # Task list (pending/completed)
│   ├── VideoPreview.tsx       # Video playback
│   └── ApiKeyInput.tsx        # API Key input
```

### Route

Add to `Router.tsx`:
```
/video-generation → VideoGeneration page
```

Add sidebar entry next to image generation.

### ipcBridge Extension

```typescript
video: {
  getModels: httpGet<VideoModelInfo[], void>('/api/video/models'),
  submit: httpPost<{ task_id: string }, VideoSubmitRequest>('/api/video/submit'),
  getStatus: httpGet<VideoTaskStatus, { task_id: string }>('/api/video/status'),
}
```

### TypeScript Types

New file: `ui/src/common/types/video.ts`

Contains: `VideoModelInfo`, `VideoSubmitRequest`, `VideoTaskStatus`, `FormField`, `DoubaoParams`, `KlingParams`, etc.

### API Key Storage

- Key: `nomifun:video:modelverse-api-key`
- Stored in localStorage, same pattern as image generation
- Support multi-key rotation via `ApiKeyManager`

## Task Status Polling Strategy

- After submitting a task, frontend auto-polls every **10 seconds** for tasks in Pending/Running state
- Polling stops when task reaches a terminal state (Success/Failure/Expired)
- User can manually refresh at any time
- Task list is maintained in frontend memory only (lost on page refresh)

## Video Playback

- On success, `urls` contains video URLs hosted by modelverse
- Frontend uses HTML `<video>` tag to play directly
- No server-side storage or proxying

## Error Handling

- Submit errors: modelverse error messages are passed through to frontend
- Network timeouts: standard `BackendHttpError`
- Invalid API key: modelverse returns 401, passed through
- Task failure: `error_message` field in `VideoTaskStatus`

## Deferred (v2)

- `callback_url` + WebSocket notification (`video:task-update` event)
- Task history persistence (would require database or file storage)
- Video download/save functionality
