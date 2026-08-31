variable "environment" {
  description = "The environment for this deployment"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "Region this vpc will be installed."
  type        = string
  default     = "us-east-1"
}

variable "api_yml_path" {
  description = "Path to the API definition YAML file"
  type        = string
  default     = "api.yaml"
}

variable "app_name" {
  description = "The name of the application"
  type        = string
  default     = "zk-sudo"
}
