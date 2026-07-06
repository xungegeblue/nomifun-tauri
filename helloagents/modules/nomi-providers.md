# nomi-providers

> 路径: `crates/agent/nomi-providers/`

## 功能

**LLM API Provider 抽象层**，将统一的 `LlmRequest` 转换为各服务商 HTTP 请求格式，通过 SSE/二进制流接收响应，解析为统一的 `LlmEvent` 流式输出。

支持的四家 Provider：
- **Anthropic** — 直接调用 Messages API（SSE 流）
- **OpenAI** — Chat Completions API 及兼容接口（SSE 流），含 DeepSeek/Gemini 兼容模型
- **AWS Bedrock** — AWS SigV4 签名调用 Claude 模型（AWS event stream 二进制帧）
- **Google Vertex AI** — GCP OAuth2 认证调用 Claude 模型（标准 SSE 流）

核心能力：流式请求/响应、SSE 解析、prompt caching、thinking/reasoning 支持、自动重试（连接+流中断）、rate limit 处理、provider 兼容性适配。

## 核心类型

| 类型 | 说明 |
|------|------|
| `LlmProvider` trait | 统一接口: `async fn stream(&self, request: &LlmRequest) -> Result<mpsc::Receiver<LlmEvent>, ProviderError>` |
| `ProviderError` | 错误枚举: Http / Api / Parse / RateLimited / PromptTooLong / Connection |
| `create_provider(config)` | 工厂函数，按 ProviderType 创建实例 |
| `AnthropicProvider` | Anthropic SSE 实现 |
| `OpenAIProvider` | OpenAI 兼容实现（含 tool_calls 累积器） |
| `BedrockProvider` | AWS Bedrock 二进制帧实现 |
| `VertexProvider` | Vertex AI 实现（含 SA/ADC/元数据服务器认证） |

## 路由

无。纯客户端库，作为 HTTP client 向外部 LLM API 发起请求。

上游端点：
- Anthropic: `{base_url}/v1/messages`
- OpenAI: `{base_url}/v1/chat/completions`
- Bedrock: `https://bedrock-runtime.{region}.amazonaws.com/model/{model}/invoke-with-response-stream`
- Vertex: `https://{region}-aiplatform.googleapis.com/.../streamRawPredict`

## 依赖

**外部**: reqwest, tokio, futures, serde, serde_json, async-trait, thiserror, aws-sigv4, aws-credential-types, aws-config, jsonwebtoken, base64, uuid, dirs
**Workspace 内**: nomi-types, nomi-config, nomifun-net

## 被依赖

被 5 个 crate 依赖: nomi-agent, nomi-cli, nomifun-ai-agent, nomifun-auth
