
module "lambda_controller_service" {
  source        = "../../../../../modules/lambda_ecr"
  function_name = "${var.app_name}-${var.lambda_name}-${var.environment}"
  iam_role_arn  = aws_iam_role.lambda_role.arn

  # handler       = "index.handler"
  # runtime       = "nodejs20.x"
  
  timeout       = 100
  memory_size   = 3008

  image_uri     = "${data.aws_ssm_parameter.controller_repository_url.value}:latest"
  # s3_bucket     = "${var.app_name}-${var.s3_bucket_name}-${var.environment}"
  # s3_key        = var.s3_bucket_key

  environment   = var.environment

  # Add the environment variables
  environment_variables = {
    REGION    = "us-east-1"
    NODE_ENV  = "prod"

    // S3
    CIRCUIT_ARTIFACTS_BUCKET_NAME = data.aws_ssm_parameter.circuit_artifacts_bucket_name.value

    // Dynamodb
    USERS_TABLE_NAME = data.aws_ssm_parameter.users_table_name.value
    NONCES_TABLE_NAME = data.aws_ssm_parameter.nonces_table_name.value
  }
}

resource "aws_ssm_parameter" "lambda_controller_service_arn" {
  name  = "/${var.app_name}/${var.environment}/services/lambda/${var.lambda_name}/arn"
  type  = "String"
  value = module.lambda_controller_service.lambda_arn
}

resource "aws_ssm_parameter" "lambda_controller_service_name" {
  name  = "/${var.app_name}/${var.environment}/services/lambda/${var.lambda_name}/name"
  type  = "String"
  value = module.lambda_controller_service.lambda_name
}

