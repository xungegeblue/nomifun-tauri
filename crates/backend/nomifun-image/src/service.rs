//! Image service — unified entry point that routes to model adapters.

use std::sync::Arc;

use crate::adapters::{DoubaoAdapter, ModelRegistry};
use crate::models::{GenerateParams, GenerateResult, ModelInfo};
use crate::schema::SchemaResponse;

/// Main image generation service.
///
/// Owns the ModelRegistry and routes all requests through it.
/// No database needed — pure API-translation layer.
#[derive(Clone)]
pub struct ImageService {
    registry: Arc<ModelRegistry>,
}

impl ImageService {
    pub fn new() -> Self {
        let mut registry = ModelRegistry::new();
        registry.register(Box::new(DoubaoAdapter::new()));
        Self {
            registry: Arc::new(registry),
        }
    }

    /// List available models.
    pub fn list_models(&self) -> Vec<ModelInfo> {
        self.registry.list_models()
    }

    /// Get parameter schema for a specific model.
    pub fn get_schema(&self, model: &str) -> Option<SchemaResponse> {
        self.registry.get_schema_response(model)
    }

    /// Generate image — routes to the correct adapter.
    pub async fn generate(
        &self,
        model: &str,
        params: GenerateParams,
        api_key: &str,
    ) -> Result<GenerateResult, nomifun_common::AppError> {
        let adapter = self
            .registry
            .get(model)
            .ok_or_else(|| nomifun_common::AppError::NotFound(format!("model not found: {model}")))?;
        adapter.generate(params, api_key).await
    }
}
