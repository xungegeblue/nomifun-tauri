//! Router state for image module.

use std::sync::Arc;

use crate::service::ImageService;

#[derive(Clone)]
pub struct ImageRouterState {
    pub image_service: Arc<ImageService>,
}
