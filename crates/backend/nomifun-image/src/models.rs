//! Shared types for image generation requests/responses.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Unified generate params — what frontend sends.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateParams {
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size: Option<String>,
    #[serde(default)]
    pub images: Vec<String>,
    #[serde(default)]
    pub watermark: bool,
    #[serde(default = "default_false")]
    pub stream: bool,
    #[serde(default = "default_url")]
    pub response_format: String,
    /// Extra params (e.g. prompt_suffix merged by frontend scenario).
    #[serde(default)]
    pub extra: HashMap<String, serde_json::Value>,
}

fn default_false() -> bool {
    false
}
fn default_url() -> String {
    "url".to_string()
}

/// Unified generate result — what frontend receives.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResult {
    pub image_url: String,
    pub model: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Model info for list_models endpoint.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub name: String,
    pub label: String,
}

/// Generate request body (POST /api/image/generate).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    pub model: String,
    pub api_key: String,
    #[serde(flatten)]
    pub params: GenerateParams,
}
