//! Axum routes for the image generation module.

use axum::extract::{Extension, Query, State};
use axum::routing::{get, post};
use axum::Json;
use axum::Router;

use nomifun_api_types::ApiResponse;
use nomifun_auth::CurrentUser;
use nomifun_common::AppError;
use serde::Deserialize;

use crate::models::{GenerateRequest, GenerateResult, ModelInfo};
use crate::schema::SchemaResponse;
use crate::state::ImageRouterState;

#[derive(Debug, Deserialize)]
struct SchemaQuery {
    model: String,
}

pub fn image_routes(state: ImageRouterState) -> Router {
    Router::new()
        .route("/api/image/models", get(list_models))
        .route("/api/image/schema", get(get_schema))
        .route("/api/image/generate", post(generate))
        .with_state(state)
}

async fn list_models(
    State(state): State<ImageRouterState>,
    Extension(_user): Extension<CurrentUser>,
) -> Result<Json<ApiResponse<Vec<ModelInfo>>>, AppError> {
    let models = state.image_service.list_models();
    Ok(Json(ApiResponse::ok(models)))
}

async fn get_schema(
    State(state): State<ImageRouterState>,
    Extension(_user): Extension<CurrentUser>,
    Query(query): Query<SchemaQuery>,
) -> Result<Json<ApiResponse<SchemaResponse>>, AppError> {
    let schema = state
        .image_service
        .get_schema(&query.model)
        .ok_or_else(|| AppError::NotFound(format!("model not found: {}", query.model)))?;
    Ok(Json(ApiResponse::ok(schema)))
}

async fn generate(
    State(state): State<ImageRouterState>,
    Extension(_user): Extension<CurrentUser>,
    Json(req): Json<GenerateRequest>,
) -> Result<Json<ApiResponse<GenerateResult>>, AppError> {
    let result = state.image_service.generate(&req.model, req.params, &req.api_key).await?;
    Ok(Json(ApiResponse::ok(result)))
}
