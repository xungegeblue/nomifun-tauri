//! Axum routes for the video generation module.

use axum::extract::{Extension, Query, State};
use axum::routing::{get, post};
use axum::Json;
use axum::Router;

use nomifun_api_types::ApiResponse;
use nomifun_auth::CurrentUser;
use nomifun_common::AppError;
use serde::Deserialize;

use crate::models::{VideoModelInfo, VideoSubmitRequest, VideoSubmitResult, VideoTaskStatus};
use crate::schema::SchemaResponse;
use crate::state::VideoRouterState;

#[derive(Debug, Deserialize)]
struct SchemaQuery {
    model: String,
}

#[derive(Debug, Deserialize)]
struct StatusQuery {
    task_id: String,
    api_key: String,
    #[serde(default)]
    model: Option<String>,
}

pub fn video_routes(state: VideoRouterState) -> Router {
    Router::new()
        .route("/api/video/models", get(list_models))
        .route("/api/video/schema", get(get_schema))
        .route("/api/video/submit", post(submit))
        .route("/api/video/status", get(query_status))
        .with_state(state)
}

async fn list_models(
    State(state): State<VideoRouterState>,
    Extension(_user): Extension<CurrentUser>,
) -> Result<Json<ApiResponse<Vec<VideoModelInfo>>>, AppError> {
    let models = state.video_service.list_models();
    Ok(Json(ApiResponse::ok(models)))
}

async fn get_schema(
    State(state): State<VideoRouterState>,
    Extension(_user): Extension<CurrentUser>,
    Query(query): Query<SchemaQuery>,
) -> Result<Json<ApiResponse<SchemaResponse>>, AppError> {
    let schema = state
        .video_service
        .get_schema(&query.model)
        .ok_or_else(|| AppError::NotFound(format!("model not found: {}", query.model)))?;
    Ok(Json(ApiResponse::ok(schema)))
}

async fn submit(
    State(state): State<VideoRouterState>,
    Extension(_user): Extension<CurrentUser>,
    Json(req): Json<VideoSubmitRequest>,
) -> Result<Json<ApiResponse<VideoSubmitResult>>, AppError> {
    let result = state
        .video_service
        .submit(&req.model, &req.api_key, &req.prompt, req.duration, &req.model_params)
        .await?;
    Ok(Json(ApiResponse::ok(result)))
}

async fn query_status(
    State(state): State<VideoRouterState>,
    Extension(_user): Extension<CurrentUser>,
    Query(query): Query<StatusQuery>,
) -> Result<Json<ApiResponse<VideoTaskStatus>>, AppError> {
    // Default to first registered model if not specified — query_status is
    // model-agnostic (same endpoint for all), but we need a valid model to
    // reach the adapter.
    let model = query.model.unwrap_or_else(|| "kling-v3".to_string());
    let status = state
        .video_service
        .query_status(&model, &query.api_key, &query.task_id)
        .await?;
    Ok(Json(ApiResponse::ok(status)))
}
