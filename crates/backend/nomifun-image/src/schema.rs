//! Schema types returned to frontend for dynamic form rendering.

use serde::{Deserialize, Serialize};

/// Field type enum — determines which UI component to render.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum FieldType {
    Text,
    Textarea,
    Select,
    Slider,
    Color,
    Toggle,
    ImageList,
    Number,
}

/// Select option for FieldType::Select fields.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectOption {
    pub value: String,
    pub label: String,
}

/// A single field definition in the parameter schema.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaField {
    pub key: String,
    pub field_type: FieldType,
    pub label: String,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_value: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub options: Option<Vec<SelectOption>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max: Option<f64>,
}

/// Full schema response: fields + default values.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaResponse {
    pub fields: Vec<SchemaField>,
    pub default_values: serde_json::Value,
}
