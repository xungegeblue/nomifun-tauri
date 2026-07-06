//! Image generation module: unified multi-model image generation service.
//!
//! Design: Registry (model management) + Strategy (per-model API adaptation).
//! Scenarios/industries are managed by the frontend — backend only translates
//! unified params to model-specific API calls.

pub mod adapters;
pub mod models;
pub mod routes;
pub mod schema;
pub mod service;
pub mod state;

pub use routes::image_routes;
pub use service::ImageService;
pub use state::ImageRouterState;
