//! Kling V3 video adapter — Strategy implementation.

use async_trait::async_trait;
use std::collections::HashMap;

use crate::adapters::{query_task_status, VideoAdapter};
use crate::models::VideoTaskStatus;
use crate::schema::{FieldType, SchemaField, SelectOption};

const SUBMIT_ENDPOINT: &str = "https://api.modelverse.cn/v1/tasks/submit";

pub struct KlingVideoAdapter;

impl KlingVideoAdapter {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl VideoAdapter for KlingVideoAdapter {
    fn model_name(&self) -> &str {
        "kling-v3"
    }

    fn model_label(&self) -> &str {
        "可灵 V3"
    }

    fn param_schema(&self) -> Vec<SchemaField> {
        vec![
            SchemaField {
                key: "klingV3Type".into(),
                field_type: FieldType::Select,
                label: "生成模式".into(),
                required: false,
                default_value: None,
                options: Some(vec![
                    SelectOption { value: "t2v".into(), label: "文生视频".into() },
                    SelectOption { value: "i2v".into(), label: "图生视频".into() },
                    SelectOption { value: "motion_control".into(), label: "运动控制".into() },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "negativePrompt".into(),
                field_type: FieldType::Textarea,
                label: "反向提示词".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "image".into(),
                field_type: FieldType::ImageList,
                label: "首帧图片".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "imageTail".into(),
                field_type: FieldType::ImageList,
                label: "尾帧图片".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "imgUrl".into(),
                field_type: FieldType::ImageList,
                label: "参考图片（运动控制）".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "videoUrl".into(),
                field_type: FieldType::Text,
                label: "参考视频 URL（运动控制）".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "characterOrientation".into(),
                field_type: FieldType::Select,
                label: "角色朝向".into(),
                required: false,
                default_value: None,
                options: Some(vec![
                    SelectOption { value: "image".into(), label: "与参考图一致".into() },
                    SelectOption { value: "video".into(), label: "与参考视频一致".into() },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "keepOriginalSound".into(),
                field_type: FieldType::Select,
                label: "保留原声".into(),
                required: false,
                default_value: Some(serde_json::Value::String("yes".into())),
                options: Some(vec![
                    SelectOption { value: "yes".into(), label: "是".into() },
                    SelectOption { value: "no".into(), label: "否".into() },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "mode".into(),
                field_type: FieldType::Select,
                label: "生成质量".into(),
                required: false,
                default_value: Some(serde_json::Value::String("std".into())),
                options: Some(vec![
                    SelectOption { value: "std".into(), label: "标准 (720P)".into() },
                    SelectOption { value: "pro".into(), label: "专业 (1080P)".into() },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "aspectRatio".into(),
                field_type: FieldType::Select,
                label: "宽高比".into(),
                required: false,
                default_value: Some(serde_json::Value::String("16:9".into())),
                options: Some(vec![
                    SelectOption { value: "16:9".into(), label: "16:9".into() },
                    SelectOption { value: "9:16".into(), label: "9:16".into() },
                    SelectOption { value: "1:1".into(), label: "1:1".into() },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "sound".into(),
                field_type: FieldType::Select,
                label: "声音".into(),
                required: false,
                default_value: Some(serde_json::Value::String("off".into())),
                options: Some(vec![
                    SelectOption { value: "on".into(), label: "开启".into() },
                    SelectOption { value: "off".into(), label: "关闭".into() },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "watermarkEnabled".into(),
                field_type: FieldType::Toggle,
                label: "水印".into(),
                required: false,
                default_value: Some(serde_json::Value::Bool(false)),
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "multiShot".into(),
                field_type: FieldType::Toggle,
                label: "多镜头模式".into(),
                required: false,
                default_value: Some(serde_json::Value::Bool(false)),
                options: None,
                min: None,
                max: None,
            },
        ]
    }

    fn default_params(&self) -> HashMap<String, serde_json::Value> {
        let mut m = HashMap::new();
        m.insert("mode".into(), serde_json::Value::String("std".into()));
        m.insert("aspectRatio".into(), serde_json::Value::String("16:9".into()));
        m.insert("sound".into(), serde_json::Value::String("off".into()));
        m.insert("watermarkEnabled".into(), serde_json::Value::Bool(false));
        m.insert("multiShot".into(), serde_json::Value::Bool(false));
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
        // Derive kling_v3_type if not explicitly set
        let kling_type = model_params
            .get("klingV3Type")
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| derive_kling_type(model_params));

        // Build input object
        let mut input = serde_json::Map::new();
        input.insert("prompt".into(), serde_json::Value::String(prompt.into()));

        if let Some(v) = model_params.get("negativePrompt").and_then(|v| v.as_str()) {
            if !v.is_empty() {
                input.insert("negative_prompt".into(), serde_json::Value::String(v.into()));
            }
        }

        // motion_control specific input fields
        if kling_type == "motion_control" {
            if let Some(url) = model_params.get("imgUrl").and_then(|v| extract_first_url(v)) {
                input.insert("img_url".into(), serde_json::Value::String(url));
            }
            if let Some(url) = model_params.get("videoUrl").and_then(|v| v.as_str()) {
                if !url.is_empty() {
                    input.insert("video_url".into(), serde_json::Value::String(url.into()));
                }
            }
        }

        // Build parameters object
        let mut parameters = serde_json::Map::new();
        parameters.insert("kling_v3_type".into(), serde_json::Value::String(kling_type.clone()));

        if let Some(dur) = duration {
            parameters.insert("duration".into(), serde_json::Value::Number(dur.into()));
        }

        // i2v image fields (go into parameters)
        if kling_type == "i2v" {
            if let Some(url) = model_params.get("image").and_then(|v| extract_first_url(v)) {
                parameters.insert("image".into(), serde_json::Value::String(url));
            }
            if let Some(url) = model_params.get("imageTail").and_then(|v| extract_first_url(v)) {
                parameters.insert("image_tail".into(), serde_json::Value::String(url));
            }
        }

        // Common parameters
        if let Some(v) = model_params.get("mode").and_then(|v| v.as_str()) {
            parameters.insert("mode".into(), serde_json::Value::String(v.into()));
        }
        if let Some(v) = model_params.get("aspectRatio").and_then(|v| v.as_str()) {
            parameters.insert("aspect_ratio".into(), serde_json::Value::String(v.into()));
        }
        if let Some(v) = model_params.get("sound").and_then(|v| v.as_str()) {
            parameters.insert("sound".into(), serde_json::Value::String(v.into()));
        }
        if let Some(v) = model_params.get("watermarkEnabled").and_then(|v| v.as_bool()) {
            parameters.insert("watermark_enabled".into(), serde_json::Value::Bool(v));
        }

        // Motion control parameters
        if kling_type == "motion_control" {
            if let Some(v) = model_params.get("characterOrientation").and_then(|v| v.as_str()) {
                parameters.insert("character_orientation".into(), serde_json::Value::String(v.into()));
            }
            if let Some(v) = model_params.get("keepOriginalSound").and_then(|v| v.as_str()) {
                parameters.insert("keep_original_sound".into(), serde_json::Value::String(v.into()));
            }
        }

        // Multi-shot parameters
        if let Some(v) = model_params.get("multiShot").and_then(|v| v.as_bool()) {
            parameters.insert("multi_shot".into(), serde_json::Value::Bool(v));
            if let Some(v) = model_params.get("shotType").and_then(|v| v.as_str()) {
                parameters.insert("shot_type".into(), serde_json::Value::String(v.into()));
            }
            if let Some(v) = model_params.get("multiPrompt") {
                parameters.insert("multi_prompt".into(), v.clone());
            }
        }

        let body = serde_json::json!({
            "model": "kling-v3",
            "input": input,
            "parameters": parameters,
        });

        tracing::debug!(model = "kling-v3", "calling kling video submit API");

        let resp = client
            .post(SUBMIT_ENDPOINT)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                nomifun_common::AppError::Internal(format!("kling video submit request failed: {e}"))
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(nomifun_common::AppError::Internal(format!(
                "kling video submit API error: status={status}, body={text}"
            )));
        }

        let result: serde_json::Value = resp.json().await.map_err(|e| {
            nomifun_common::AppError::Internal(format!(
                "kling video submit response parse failed: {e}"
            ))
        })?;

        let task_id = result["output"]["task_id"]
            .as_str()
            .ok_or_else(|| {
                nomifun_common::AppError::Internal(
                    "kling video submit: no task_id in response".to_string(),
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

/// Derive kling_v3_type from model_params when not explicitly set.
/// Priority: videoUrl present → motion_control; image/imgUrl present → i2v; else → t2v.
fn derive_kling_type(model_params: &serde_json::Value) -> String {
    if model_params
        .get("videoUrl")
        .and_then(|v| v.as_str())
        .is_some_and(|s| !s.is_empty())
    {
        return "motion_control".into();
    }
    if model_params.get("image").is_some()
        || model_params.get("imgUrl").is_some()
    {
        return "i2v".into();
    }
    "t2v".into()
}

/// Extract the first URL from an image field value (same logic as doubao adapter).
fn extract_first_url(value: &serde_json::Value) -> Option<String> {
    if let Some(url) = value.as_str() {
        if !url.is_empty() {
            return Some(url.to_string());
        }
    }
    if let Some(arr) = value.as_array() {
        if let Some(first) = arr.first().and_then(|v| v.as_str()) {
            if !first.is_empty() {
                return Some(first.to_string());
            }
        }
    }
    None
}
