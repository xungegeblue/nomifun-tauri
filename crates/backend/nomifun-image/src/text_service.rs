//! Text service — unified entry point that routes to text model adapters.

use std::sync::Arc;

use crate::text_adapters::{DeepSeekAdapter, TextModelRegistry};
use crate::text_models::{ChatMessage, TextChatResponse, TextModelInfo};

/// Main text generation service.
///
/// Owns the TextModelRegistry and routes all requests through it.
/// No database needed — pure API-translation layer.
#[derive(Clone)]
pub struct TextService {
    registry: Arc<TextModelRegistry>,
}

impl TextService {
    pub fn new() -> Self {
        let mut registry = TextModelRegistry::new();
        registry.register(Box::new(DeepSeekAdapter::new()));
        Self {
            registry: Arc::new(registry),
        }
    }

    /// List available text models.
    pub fn list_models(&self) -> Vec<TextModelInfo> {
        self.registry.list_models()
    }

    /// Chat completion — routes to the correct adapter.
    pub async fn chat(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        api_key: &str,
        stream: bool,
        temperature: Option<f64>,
        max_tokens: Option<u32>,
    ) -> Result<TextChatResponse, nomifun_common::AppError> {
        let adapter = self
            .registry
            .get(model)
            .ok_or_else(|| {
                nomifun_common::AppError::NotFound(format!("text model not found: {model}"))
            })?;
        adapter
            .chat(&messages, api_key, stream, temperature, max_tokens)
            .await
    }
}
