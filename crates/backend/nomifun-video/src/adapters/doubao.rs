//! Doubao (豆包) Seedance 2.0 video adapter — Strategy implementation.

use async_trait::async_trait;
use std::collections::HashMap;

use crate::adapters::{query_task_status, VideoAdapter};
use crate::models::VideoTaskStatus;
use crate::schema::{FieldType, SchemaField, SelectOption};

const SUBMIT_ENDPOINT: &str = "https://api.modelverse.cn/v1/tasks/submit";

/// Adapter for doubao-seedance-2-0-260128 and doubao-seedance-2-0-mini-260615.
pub struct DoubaoVideoAdapter {
    model_id: &'static str,
    model_label: &'static str,
    /// Supported resolutions for this variant.
    resolutions: Vec<SelectOption>,
}

impl DoubaoVideoAdapter {
    /// Full model (4K support).
    pub fn full() -> Self {
        Self {
            model_id: "doubao-seedance-2-0-260128",
            model_label: "豆包 Seedance 2.0",
            resolutions: vec![
                SelectOption { value: "480p".into(), label: "480p".into() },
                SelectOption { value: "720p".into(), label: "720p".into() },
                SelectOption { value: "1080p".into(), label: "1080p".into() },
                SelectOption { value: "4K".into(), label: "4K".into() },
            ],
        }
    }

    /// Mini model (up to 720p).
    pub fn mini() -> Self {
        Self {
            model_id: "doubao-seedance-2-0-mini-260615",
            model_label: "豆包 Seedance 2.0 Mini",
            resolutions: vec![
                SelectOption { value: "480p".into(), label: "480p".into() },
                SelectOption { value: "720p".into(), label: "720p".into() },
            ],
        }
    }
}

#[async_trait]
impl VideoAdapter for DoubaoVideoAdapter {
    fn model_name(&self) -> &str {
        self.model_id
    }

    fn model_label(&self) -> &str {
        self.model_label
    }

    fn param_schema(&self) -> Vec<SchemaField> {
        vec![
            SchemaField {
                key: "firstFrameImage".into(),
                field_type: FieldType::ImageList,
                label: "首帧图片".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "lastFrameImage".into(),
                field_type: FieldType::ImageList,
                label: "尾帧图片".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "referenceImage".into(),
                field_type: FieldType::ImageList,
                label: "参考图片".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "referenceVideo".into(),
                field_type: FieldType::Text,
                label: "参考视频 URL".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "referenceAudio".into(),
                field_type: FieldType::Text,
                label: "参考音频 URL".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "resolution".into(),
                field_type: FieldType::Select,
                label: "分辨率".into(),
                required: false,
                default_value: Some(serde_json::Value::String("720p".into())),
                options: Some(self.resolutions.clone()),
                min: None,
                max: None,
            },
            SchemaField {
                key: "ratio".into(),
                field_type: FieldType::Select,
                label: "宽高比".into(),
                required: false,
                default_value: Some(serde_json::Value::String("adaptive".into())),
                options: Some(vec![
                    SelectOption { value: "adaptive".into(), label: "自动".into() },
                    SelectOption { value: "16:9".into(), label: "16:9".into() },
                    SelectOption { value: "4:3".into(), label: "4:3".into() },
                    SelectOption { value: "1:1".into(), label: "1:1".into() },
                    SelectOption { value: "3:4".into(), label: "3:4".into() },
                    SelectOption { value: "9:16".into(), label: "9:16".into() },
                    SelectOption { value: "21:9".into(), label: "21:9".into() },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "generateAudio".into(),
                field_type: FieldType::Toggle,
                label: "生成声音".into(),
                required: false,
                default_value: Some(serde_json::Value::Bool(false)),
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "cameraFixed".into(),
                field_type: FieldType::Toggle,
                label: "固定摄像头".into(),
                required: false,
                default_value: Some(serde_json::Value::Bool(false)),
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "watermark".into(),
                field_type: FieldType::Toggle,
                label: "水印".into(),
                required: false,
                default_value: Some(serde_json::Value::Bool(false)),
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "seed".into(),
                field_type: FieldType::Number,
                label: "随机种子".into(),
                required: false,
                default_value: None,
                options: None,
                min: Some(0.0),
                max: Some(2147483647.0),
            },
        ]
    }

    fn default_params(&self) -> HashMap<String, serde_json::Value> {
        let mut m = HashMap::new();
        m.insert("resolution".into(), serde_json::Value::String("720p".into()));
        m.insert("ratio".into(), serde_json::Value::String("adaptive".into()));
        m.insert("generateAudio".into(), serde_json::Value::Bool(false));
        m.insert("cameraFixed".into(), serde_json::Value::Bool(false));
        m.insert("watermark".into(), serde_json::Value::Bool(false));
        m
    }

    async fn submit(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        prompt: &str,
        duration: Option<u32>,
        model_params: &serde_json::Value,
    ) -> Result<String, nomifun_common::AppError> {
        // Build input.content[] array
        let mut content = Vec::new();

        // Text prompt
        content.push(serde_json::json!({
            "type": "text",
            "text": prompt,
        }));

        // Image inputs
        if let Some(img) = model_params.get("firstFrameImage") {
            if let Some(url) = extract_image_url(img) {
                content.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": { "url": url },
                    "role": "first_frame",
                }));
            }
        }
        if let Some(img) = model_params.get("lastFrameImage") {
            if let Some(url) = extract_image_url(img) {
                content.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": { "url": url },
                    "role": "last_frame",
                }));
            }
        }
        if let Some(img) = model_params.get("referenceImage") {
            if let Some(url) = extract_image_url(img) {
                content.push(serde_json::json!({
                    "type": "image_url",
                    "image_url": { "url": url },
                    "role": "reference_image",
                }));
            }
        }

        // Video input
        if let Some(url) = model_params.get("referenceVideo").and_then(|v| v.as_str()) {
            if !url.is_empty() {
                content.push(serde_json::json!({
                    "type": "video_url",
                    "video_url": { "url": url },
                    "role": "reference_video",
                }));
            }
        }

        // Audio input
        if let Some(url) = model_params.get("referenceAudio").and_then(|v| v.as_str()) {
            if !url.is_empty() {
                content.push(serde_json::json!({
                    "type": "audio_url",
                    "audio_url": { "url": url },
                    "role": "reference_audio",
                }));
            }
        }

        // Build parameters
        let mut parameters = serde_json::Map::new();
        if let Some(dur) = duration {
            parameters.insert("duration".into(), serde_json::Value::Number(dur.into()));
        }
        if let Some(v) = model_params.get("resolution").and_then(|v| v.as_str()) {
            parameters.insert("resolution".into(), serde_json::Value::String(v.into()));
        }
        if let Some(v) = model_params.get("ratio").and_then(|v| v.as_str()) {
            parameters.insert("ratio".into(), serde_json::Value::String(v.into()));
        }
        if let Some(v) = model_params.get("generateAudio").and_then(|v| v.as_bool()) {
            parameters.insert("generate_audio".into(), serde_json::Value::Bool(v));
        }
        if let Some(v) = model_params.get("cameraFixed").and_then(|v| v.as_bool()) {
            parameters.insert("camera_fixed".into(), serde_json::Value::Bool(v));
        }
        if let Some(v) = model_params.get("watermark").and_then(|v| v.as_bool()) {
            parameters.insert("watermark".into(), serde_json::Value::Bool(v));
        }
        if let Some(v) = model_params.get("seed").and_then(|v| v.as_u64()) {
            parameters.insert("seed".into(), serde_json::Value::Number(v.into()));
        }

        let body = serde_json::json!({
            "model": self.model_id,
            "input": { "content": content },
            "parameters": parameters,
        });

        tracing::debug!(model = self.model_id, "calling doubao video submit API");

        let resp = client
            .post(SUBMIT_ENDPOINT)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                nomifun_common::AppError::Internal(format!("doubao video submit request failed: {e}"))
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(nomifun_common::AppError::Internal(format!(
                "doubao video submit API error: status={status}, body={text}"
            )));
        }

        let result: serde_json::Value = resp.json().await.map_err(|e| {
            nomifun_common::AppError::Internal(format!(
                "doubao video submit response parse failed: {e}"
            ))
        })?;

        let task_id = result["output"]["task_id"]
            .as_str()
            .ok_or_else(|| {
                nomifun_common::AppError::Internal(
                    "doubao video submit: no task_id in response".to_string(),
                )
            })?
            .to_string();

        Ok(task_id)
    }

    async fn query_status(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        task_id: &str,
    ) -> Result<VideoTaskStatus, nomifun_common::AppError> {
        query_task_status(client, api_key, task_id).await
    }
}

/// Extract a URL from the image field value.
/// The frontend may send a plain URL string or an array of URLs (ImageList).
/// For video generation, we take the first URL.
fn extract_image_url(value: &serde_json::Value) -> Option<String> {
    if let Some(url) = value.as_str() {
        if !url.is_empty() {
            return Some(url.to_string());
        }
    }
    // ImageList sends an array of strings
    if let Some(arr) = value.as_array() {
        if let Some(first) = arr.first().and_then(|v| v.as_str()) {
            if !first.is_empty() {
                return Some(first.to_string());
            }
        }
    }
    None
}
