//! DeepSeek adapter — calls modelverse chat completions API.
//!
/// Uses the unified modelverse endpoint: POST https://api.modelverse.cn/v1/chat/completions

use async_trait::async_trait;

use crate::text_models::{ChatMessage, TextChatResponse, TokenUsage};
use crate::text_adapters::TextAdapter;

const MODELVERSE_CHAT_ENDPOINT: &str = "https://api.modelverse.cn/v1/chat/completions";
const DEEPSEEK_MODEL: &str = "deepseek-v4-flash";

pub struct DeepSeekAdapter {
    client: reqwest::Client,
}

impl DeepSeekAdapter {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }
}

#[async_trait]
impl TextAdapter for DeepSeekAdapter {
    fn model_name(&self) -> &str {
        DEEPSEEK_MODEL
    }

    fn model_label(&self) -> &str {
        "DeepSeek V4 Flash"
    }

    async fn chat(
        &self,
        messages: &[ChatMessage],
        api_key: &str,
        stream: bool,
        temperature: Option<f64>,
        max_tokens: Option<u32>,
    ) -> Result<TextChatResponse, nomifun_common::AppError> {
        let messages_json: Vec<serde_json::Value> = messages
            .iter()
            .map(|m| {
                serde_json::json!({
                    "role": m.role,
                    "content": m.content,
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "model": DEEPSEEK_MODEL,
            "messages": messages_json,
            "stream": stream,
        });

        if let Some(temp) = temperature {
            body["temperature"] = serde_json::Value::from(temp);
        }
        if let Some(tokens) = max_tokens {
            body["max_tokens"] = serde_json::Value::from(tokens);
        }

        tracing::debug!(model = DEEPSEEK_MODEL, "calling modelverse chat completions API");

        let resp = self
            .client
            .post(MODELVERSE_CHAT_ENDPOINT)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| {
                nomifun_common::AppError::Internal(format!(
                    "modelverse chat API request failed: {e}"
                ))
            })?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(nomifun_common::AppError::Internal(format!(
                "modelverse chat API error: status={status}, body={text}"
            )));
        }

        let result: serde_json::Value = resp.json().await.map_err(|e| {
            nomifun_common::AppError::Internal(format!(
                "modelverse chat response parse failed: {e}"
            ))
        })?;

        // Extract content from OpenAI-compatible response format
        let content = result["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let model = result["model"]
            .as_str()
            .unwrap_or(DEEPSEEK_MODEL)
            .to_string();

        let usage = result.get("usage").and_then(|u| {
            Some(TokenUsage {
                prompt_tokens: u["prompt_tokens"].as_u64()? as u32,
                completion_tokens: u["completion_tokens"].as_u64()? as u32,
                total_tokens: u["total_tokens"].as_u64()? as u32,
            })
        });

        Ok(TextChatResponse {
            content,
            model,
            usage,
        })
    }
}
