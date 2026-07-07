//! Image generation module: unified multi-model image generation service.
//!
//! Design: Registry (model management) + Strategy (per-model API adaptation).
//! Scenarios/industries are managed by the frontend — backend only translates
//! unified params to model-specific API calls.
//!
//! Also includes text generation (chat completions) following the same pattern.

pub mod adapters;
pub mod models;
pub mod routes;
pub mod schema;
pub mod service;
pub mod state;
pub mod text_adapters;
pub mod text_models;
pub mod text_routes;
pub mod text_service;

pub use routes::image_routes;
pub use service::ImageService;
pub use state::ImageRouterState;
pub use text_routes::text_routes;
pub use text_service::TextService;
