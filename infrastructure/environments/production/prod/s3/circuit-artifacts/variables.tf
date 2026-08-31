
variable "environment" {
  description = "The environment for this deployment (e.g., prod, staging, development)"
  default     = "prod"
  type        = string
}

variable "app_name" {
  type    = string
  default = "zk-sudo"
}

variable "s3_bucket_name" {
  type    = string
  default = "circuit-artifacts"
}

variable "additional_tags" {
  default     = {}
  description = "Additional resource tags"
  type        = map(string)
}