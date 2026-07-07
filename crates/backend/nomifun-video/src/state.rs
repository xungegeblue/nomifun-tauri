//! Router state for video module.

use std::sync::Arc;

use crate::service::VideoService;

#[derive(Clone)]
pub struct VideoRouterState {
    pub video_service: Arc<VideoService>,
}
