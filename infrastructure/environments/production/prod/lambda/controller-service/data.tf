# you'd be needing this if you have a data source attached to the lambda function
data "aws_ssm_parameter" "controller_repository_url" {
  name = "/${var.app_name}/${var.environment}/ecr/controller/repository-url"
}

data "aws_ssm_parameter" "users_dynamodb_arn" {
  name = "/${var.app_name}/${var.environment}/databases/users/arn"
}

data "aws_ssm_parameter" "users_table_name" {
  name = "/${var.app_name}/${var.environment}/databases/users/name"
}

data "aws_ssm_parameter" "nonces_dynamodb_arn" {
  name = "/${var.app_name}/${var.environment}/databases/nonces/arn"
}

# update - t3 (enrol-tokens table ARN for the Lambda's DynamoDB policy)
data "aws_ssm_parameter" "enroll_tokens_dynamodb_arn" {
  name = "/${var.app_name}/${var.environment}/databases/enroll-tokens/arn"
}

data "aws_ssm_parameter" "nonces_table_name" {
  name = "/${var.app_name}/${var.environment}/databases/nonces/name"
}

data "aws_ssm_parameter" "circuit_artifacts_bucket_arn" {
  name = "/${var.app_name}/${var.environment}/s3/circuit-artifacts/arn"
}

data "aws_ssm_parameter" "circuit_artifacts_bucket_name" {
  name = "/${var.app_name}/${var.environment}/s3/circuit-artifacts/name"
}