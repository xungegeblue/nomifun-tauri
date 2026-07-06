//! ImageAdapter trait (Strategy) + ModelRegistry (Registry).

mod doubao;

use async_trait::async_trait;
use std::collections::HashMap;

use crate::models::{GenerateParams, GenerateResult, ModelInfo};
use crate::schema::{SchemaField, SchemaResponse};

pub use doubao::DoubaoAdapter;

/// Adapter trait — each model implements this to translate unified params
/// into model-specific API calls.
#[async_trait]
pub trait ImageAdapter: Send + Sync {
    /// Model identifier (e.g. "doubao-seedream-4.5").
    fn model_name(&self) -> &str;

    /// Human-readable label (e.g. "豆包 Seedream 4.5").
    fn model_label(&self) -> &str;

    /// Parameter schema for this model (sent to frontend for dynamic form).
    fn param_schema(&self) -> Vec<SchemaField>;

    /// Default parameter values for this model.
    fn default_params(&self) -> HashMap<String, serde_json::Value>;

    /// Execute image generation: translate params → call API → parse response.
    async fn generate(
        &self,
        params: GenerateParams,
        api_key: &str,
    ) -> Result<GenerateResult, nomifun_common::AppError>;
}

/// Model registry — stores all registered adapters.
pub struct ModelRegistry {
    adapters: HashMap<String, Box<dyn ImageAdapter>>,
}

impl ModelRegistry {
    pub fn new() -> Self {
        Self {
            adapters: HashMap::new(),
        }
    }

    pub fn register(&mut self, adapter: Box<dyn ImageAdapter>) {
        self.adapters.insert(adapter.model_name().to_string(), adapter);
    }

    pub fn get(&self, model: &str) -> Option<&dyn ImageAdapter> {
        self.adapters.get(model).map(|b| b.as_ref())
    }

    pub fn list_models(&self) -> Vec<ModelInfo> {
        self.adapters
            .values()
            .map(|a| ModelInfo {
                name: a.model_name().to_string(),
                label: a.model_label().to_string(),
            })
            .collect()
    }

    pub fn get_schema_response(&self, model: &str) -> Option<SchemaResponse> {
        self.get(model).map(|a| SchemaResponse {
            fields: a.param_schema(),
            default_values: serde_json::to_value(a.default_params()).unwrap_or(serde_json::Value::Object(
                serde_json::Map::new(),
            )),
        })
    }
}
