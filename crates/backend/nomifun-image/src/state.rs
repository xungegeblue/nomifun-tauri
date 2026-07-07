//! Router state for image module (includes text generation service).

use std::sync::Arc;

use crate::service::ImageService;
use crate::text_service::TextService;

#[derive(Clone)]
pub struct ImageRouterState {
    pub image_service: Arc<ImageService>,
    pub text_service: Arc<TextService>,
}
