//! Video generation module: unified multi-model video generation service.
//!
//! Design: Registry (model management) + Strategy (per-model API adaptation).
//! Follows the same pattern as `nomifun-image`.

pub mod adapters;
pub mod models;
pub mod routes;
pub mod schema;
pub mod service;
pub mod state;

pub use routes::video_routes;
pub use service::VideoService;
pub use state::VideoRouterState;
