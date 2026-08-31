data "aws_ssm_parameter" "enroll_tokens_dynamodb_arn" {
  name = "/${var.app_name}/${var.environment}/databases/enroll-tokens/arn"
}

data "aws_ssm_parameter" "enroll_tokens_dynamodb_name" {
  name = "/${var.app_name}/${var.environment}/databases/enroll-tokens/name"
}