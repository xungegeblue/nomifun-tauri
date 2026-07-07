//! Video service — unified entry point that routes to model adapters.

use std::sync::Arc;

use crate::adapters::{DoubaoVideoAdapter, KlingVideoAdapter, ModelRegistry};
use crate::models::{VideoModelInfo, VideoSubmitResult, VideoTaskStatus};
use crate::schema::SchemaResponse;

/// Main video generation service.
///
/// Owns the ModelRegistry and routes all requests through it.
/// No database needed — pure API-translation layer.
#[derive(Clone)]
pub struct VideoService {
    registry: Arc<ModelRegistry>,
    client: reqwest::Client,
}

impl VideoService {
    pub fn new() -> Self {
        let mut registry = ModelRegistry::new();
        registry.register(Box::new(DoubaoVideoAdapter::full()));
        registry.register(Box::new(DoubaoVideoAdapter::mini()));
        registry.register(Box::new(KlingVideoAdapter::new()));
        Self {
            registry: Arc::new(registry),
            client: reqwest::Client::new(),
        }
    }

    /// List available models.
    pub fn list_models(&self) -> Vec<VideoModelInfo> {
        self.registry.list_models()
    }

    /// Get parameter schema for a specific model.
    pub fn get_schema(&self, model: &str) -> Option<SchemaResponse> {
        self.registry.get_schema_response(model)
    }

    /// Submit a video generation task.
    pub async fn submit(
        &self,
        model: &str,
        api_key: &str,
        prompt: &str,
        duration: Option<u32>,
        model_params: &serde_json::Value,
    ) -> Result<VideoSubmitResult, nomifun_common::AppError> {
        let adapter = self
            .registry
            .get(model)
            .ok_or_else(|| {
                nomifun_common::AppError::NotFound(format!("model not found: {model}"))
            })?;
        let task_id = adapter
            .submit(&self.client, api_key, prompt, duration, model_params)
            .await?;
        Ok(VideoSubmitResult {
            task_id,
            request_id: None,
        })
    }

    /// Query the status of a previously submitted task.
    pub async fn query_status(
        &self,
        model: &str,
        api_key: &str,
        task_id: &str,
    ) -> Result<VideoTaskStatus, nomifun_common::AppError> {
        let adapter = self
            .registry
            .get(model)
            .ok_or_else(|| {
                nomifun_common::AppError::NotFound(format!("model not found: {model}"))
            })?;
        adapter.query_status(&self.client, api_key, task_id).await
    }
}
