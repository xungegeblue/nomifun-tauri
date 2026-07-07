//! Video generation DTOs.

use serde::{Deserialize, Serialize};

/// Request body for POST /api/video/submit.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoSubmitRequest {
    pub model: String,
    pub api_key: String,
    pub prompt: String,
    pub duration: Option<u32>,
    pub model_params: serde_json::Value,
}

/// Response body for POST /api/video/submit.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoSubmitResult {
    pub task_id: String,
    pub request_id: Option<String>,
}

/// Video task status — returned by GET /api/video/status and also used
/// internally by adapters.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoTaskStatus {
    pub task_id: String,
    pub task_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub urls: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub submit_time: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finish_time: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub request_id: Option<String>,
}

/// Model info — returned by GET /api/video/models.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoModelInfo {
    pub name: String,
    pub label: String,
}
