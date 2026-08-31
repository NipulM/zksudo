# update - t3 (backing store for single-use, short-TTL bootstrap enrolment
# tokens; mirrors the nonces/users table variable shape.)
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

variable "table_name" {
  type    = string
  default = "enroll-tokens"
}
