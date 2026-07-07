//! VideoAdapter trait (Strategy) + ModelRegistry (Registry) + shared helpers.

mod doubao;
mod kling;

use async_trait::async_trait;
use std::collections::HashMap;

use crate::models::{VideoModelInfo, VideoTaskStatus};
use crate::schema::{SchemaField, SchemaResponse};

pub use doubao::DoubaoVideoAdapter;
pub use kling::KlingVideoAdapter;

/// Adapter trait — each model implements this to translate unified params
/// into model-specific API calls.
#[async_trait]
pub trait VideoAdapter: Send + Sync {
    /// Model identifier (e.g. "doubao-seedance-2-0-260128").
    fn model_name(&self) -> &str;

    /// Human-readable label (e.g. "豆包 Seedance 2.0").
    fn model_label(&self) -> &str;

    /// Parameter schema for this model (sent to frontend for dynamic form).
    fn param_schema(&self) -> Vec<SchemaField>;

    /// Default parameter values for this model.
    fn default_params(&self) -> HashMap<String, serde_json::Value>;

    /// Submit a video generation task.
    /// Returns the task_id on success.
    async fn submit(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        prompt: &str,
        duration: Option<u32>,
        model_params: &serde_json::Value,
    ) -> Result<String, nomifun_common::AppError>;

    /// Query the status of a previously submitted task.
    async fn query_status(
        &self,
        client: &reqwest::Client,
        api_key: &str,
        task_id: &str,
    ) -> Result<VideoTaskStatus, nomifun_common::AppError>;
}

/// Shared query_status helper — both models use the same modelverse endpoint.
pub async fn query_task_status(
    client: &reqwest::Client,
    api_key: &str,
    task_id: &str,
) -> Result<VideoTaskStatus, nomifun_common::AppError> {
    let url = format!(
        "https://api.modelverse.cn/v1/tasks/status?task_id={}",
        task_id
    );

    tracing::debug!(task_id, "querying video task status");

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| {
            nomifun_common::AppError::Internal(format!("video task status request failed: {e}"))
        })?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(nomifun_common::AppError::Internal(format!(
            "video task status API error: status={status}, body={text}"
        )));
    }

    let result: serde_json::Value = resp.json().await.map_err(|e| {
        nomifun_common::AppError::Internal(format!(
            "video task status response parse failed: {e}"
        ))
    })?;

    let output = &result["output"];
    let task_status = VideoTaskStatus {
        task_id: output["task_id"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        task_status: output["task_status"]
            .as_str()
            .unwrap_or("Pending")
            .to_string(),
        urls: output
            .get("urls")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            }),
        submit_time: output["submit_time"].as_i64(),
        finish_time: output["finish_time"].as_i64(),
        error_message: output["error_message"]
            .as_str()
            .map(String::from),
        duration: result
            .get("usage")
            .and_then(|u| u["duration"].as_u64())
            .map(|d| d as u32),
        request_id: result["request_id"].as_str().map(String::from),
    };

    Ok(task_status)
}

/// Model registry — stores all registered adapters.
pub struct ModelRegistry {
    adapters: HashMap<String, Box<dyn VideoAdapter>>,
}

impl ModelRegistry {
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
        }
    }

    pub fn register(&mut self, adapter: Box<dyn VideoAdapter>) {
        self.adapters
            .insert(adapter.model_name().to_string(), adapter);
    }

    pub fn get(&self, model: &str) -> Option<&dyn VideoAdapter> {
        self.adapters.get(model).map(|b| b.as_ref())
    }

    pub fn list_models(&self) -> Vec<VideoModelInfo> {
        self.adapters
            .values()
            .map(|a| VideoModelInfo {
                name: a.model_name().to_string(),
                label: a.model_label().to_string(),
            })
            .collect()
    }

    pub fn get_schema_response(&self, model: &str) -> Option<SchemaResponse> {
        self.get(model).map(|a| SchemaResponse {
            fields: a.param_schema(),
            default_values: serde_json::to_value(a.default_params()).unwrap_or(
                serde_json::Value::Object(serde_json::Map::new()),
            ),
        })
    }
}
