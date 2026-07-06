//! Doubao (豆包) Seedream 4.5 adapter — Strategy implementation.

use async_trait::async_trait;
use std::collections::HashMap;

use crate::models::{GenerateParams, GenerateResult};
use crate::schema::{FieldType, SchemaField, SelectOption};
use crate::adapters::ImageAdapter;

const DOUBAO_ENDPOINT: &str = "https://api.modelverse.cn/v1/images/generations";
const DOUBAO_MODEL: &str = "doubao-seedream-4.5";

pub struct DoubaoAdapter {
    client: reqwest::Client,
}

impl DoubaoAdapter {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl ImageAdapter for DoubaoAdapter {
    fn model_name(&self) -> &str {
        DOUBAO_MODEL
    }

    fn model_label(&self) -> &str {
        "豆包 Seedream 4.5"
    }

    fn param_schema(&self) -> Vec<SchemaField> {
        vec![
            SchemaField {
                key: "prompt".into(),
                field_type: FieldType::Textarea,
                label: "提示词".into(),
                required: true,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
            SchemaField {
                key: "size".into(),
                field_type: FieldType::Select,
                label: "图片尺寸".into(),
                required: false,
                default_value: Some(serde_json::Value::String("2k".into())),
                options: Some(vec![
                    SelectOption {
                        value: "2k".into(),
                        label: "2K (2048×2048)".into(),
                    },
                    SelectOption {
                        value: "4k".into(),
                        label: "4K".into(),
                    },
                    SelectOption {
                        value: "2304x1728".into(),
                        label: "2304×1728".into(),
                    },
                ]),
                min: None,
                max: None,
            },
            SchemaField {
                key: "images".into(),
                field_type: FieldType::ImageList,
                label: "参考图片（图生图）".into(),
                required: false,
                default_value: None,
                options: None,
                min: None,
                max: None,
            },
        ]
    }

    fn default_params(&self) -> HashMap<String, serde_json::Value> {
        let mut m = HashMap::new();
        m.insert("size".into(), serde_json::Value::String("2k".into()));
        m.insert("watermark".into(), serde_json::Value::Bool(false));
        m.insert("stream".into(), serde_json::Value::Bool(false));
        m.insert("responseFormat".into(), serde_json::Value::String("url".into()));
        m
    }

    async fn generate(
        &self,
        params: GenerateParams,
        api_key: &str,
    ) -> Result<GenerateResult, nomifun_common::AppError> {
        let mut body = serde_json::json!({
            "model": DOUBAO_MODEL,
            "prompt": params.prompt,
        });

        if let Some(size) = &params.size {
            body["size"] = serde_json::Value::String(size.clone());
        } else {
            body["size"] = serde_json::Value::String("2k".to_string());
        }
        if !params.images.is_empty() {
            body["images"] = serde_json::to_value(&params.images)
                .map_err(|e| nomifun_common::AppError::Internal(e.to_string()))?;
        }
        body["watermark"] = serde_json::Value::Bool(params.watermark);
        body["stream"] = serde_json::Value::Bool(params.stream);
        body["response_format"] = serde_json::Value::String(params.response_format);

        tracing::debug!(model = DOUBAO_MODEL, "calling doubao image generation API");

        let resp = self
            .client
            .post(DOUBAO_ENDPOINT)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| nomifun_common::AppError::Internal(format!("doubao API request failed: {e}")))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(nomifun_common::AppError::Internal(
                format!("doubao API error: status={status}, body={text}"),
            ));
        }

        let result: serde_json::Value = resp
            .json()
            .await
            .map_err(|e| nomifun_common::AppError::Internal(format!("doubao response parse failed: {e}")))?;

        let image_url = result["data"][0]["url"]
            .as_str()
            .ok_or_else(|| nomifun_common::AppError::Internal("doubao: no image URL in response".to_string()))?
            .to_string();

        Ok(GenerateResult {
            image_url,
            model: DOUBAO_MODEL.to_string(),
            metadata: None,
        })
    }
}
