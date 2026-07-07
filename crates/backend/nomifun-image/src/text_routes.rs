//! Axum routes for the text generation module.

use axum::extract::{Extension, State};
use axum::routing::{get, post};
use axum::Json;
use axum::Router;

use nomifun_api_types::ApiResponse;
use nomifun_auth::CurrentUser;
use nomifun_common::AppError;

use crate::text_models::{TextChatRequest, TextChatResponse, TextModelInfo};
use crate::state::ImageRouterState;

pub fn text_routes(state: ImageRouterState) -> Router {
    Router::new()
        .route("/api/text/models", get(list_text_models))
        .route("/api/text/chat", post(text_chat))
        .with_state(state)
}

async fn list_text_models(
    State(state): State<ImageRouterState>,
    Extension(_user): Extension<CurrentUser>,
) -> Result<Json<ApiResponse<Vec<TextModelInfo>>>, AppError> {
    let models = state.text_service.list_models();
    Ok(Json(ApiResponse::ok(models)))
}

async fn text_chat(
    State(state): State<ImageRouterState>,
    Extension(_user): Extension<CurrentUser>,
    Json(req): Json<TextChatRequest>,
) -> Result<Json<ApiResponse<TextChatResponse>>, AppError> {
    let result = state
        .text_service
        .chat(
            &req.model,
            req.messages,
            &req.api_key,
            req.stream,
            req.temperature,
            req.max_tokens,
        )
        .await?;
    Ok(Json(ApiResponse::ok(result)))
}
