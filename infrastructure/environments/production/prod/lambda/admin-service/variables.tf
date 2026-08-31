variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "prod"
}

variable "app_name" {
  type    = string
  default = "zk-sudo"
}

variable "lambda_name" {
  type    = string
  default = "admin-service"
}

variable "s3_bucket_name" {
  type    = string
  default = "lambda-packages"
}

variable "s3_bucket_key" {
  type    = string
  default = "admin-service/deployment.zip"
}