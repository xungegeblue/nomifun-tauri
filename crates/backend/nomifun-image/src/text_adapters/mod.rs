//! TextAdapter trait (Strategy) + TextModelRegistry (Registry).
//!
//! Mirrors the ImageAdapter / ModelRegistry pattern for text chat completions.

mod deepseek;

use async_trait::async_trait;

use crate::text_models::{ChatMessage, TextChatResponse, TextModelInfo};
use crate::text_models::TokenUsage;

pub use deepseek::DeepSeekAdapter;

/// Adapter trait — each text model implements this to translate unified params
/// into model-specific API calls.
#[async_trait]
pub trait TextAdapter: Send + Sync {
    /// Model identifier (e.g. "deepseek-v4-flash").
    fn model_name(&self) -> &str;

    /// Human-readable label (e.g. "DeepSeek V4 Flash").
    fn model_label(&self) -> &str;

    /// Execute chat completion: translate messages → call API → parse response.
    async fn chat(
        &self,
        messages: &[ChatMessage],
        api_key: &str,
        stream: bool,
        temperature: Option<f64>,
        max_tokens: Option<u32>,
    ) -> Result<TextChatResponse, nomifun_common::AppError>;
}

/// Model registry — stores all registered text adapters.
pub struct TextModelRegistry {
    adapters: std::collections::HashMap<String, Box<dyn TextAdapter>>,
}

impl TextModelRegistry {
    pub fn new() -> Self {
        Self {
            adapters: std::collections::HashMap::new(),
        }
    }

    pub fn register(&mut self, adapter: Box<dyn TextAdapter>) {
        self.adapters.insert(adapter.model_name().to_string(), adapter);
    }

    pub fn get(&self, model: &str) -> Option<&dyn TextAdapter> {
        self.adapters.get(model).map(|b| b.as_ref())
    }

    pub fn list_models(&self) -> Vec<TextModelInfo> {
        self.adapters
            .values()
            .map(|a| TextModelInfo {
                name: a.model_name().to_string(),
                label: a.model_label().to_string(),
            })
            .collect()
    }
}
