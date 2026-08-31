
module "lambda_admin_service" {
  source        = "../../../../../modules/lambda"
  function_name = "${var.app_name}-${var.lambda_name}-${var.environment}"
  iam_role_arn  = aws_iam_role.lambda_role.arn

  handler       = "dist/index.handler"
  runtime       = "nodejs20.x"
  
  timeout       = 100
  memory_size   = 3008

  s3_bucket     = "${var.app_name}-${var.s3_bucket_name}-${var.environment}"
  s3_key        = var.s3_bucket_key

  environment   = var.environment

  # Add the environment variables
  environment_variables = {
    REGION    = "us-east-1"
    NODE_ENV  = "prod"

    // Dynamodb
    ENROLL_TOKENS_TABLE_NAME = data.aws_ssm_parameter.enroll_tokens_dynamodb_name.value

    // IAM:
    EXECUTION_ROLE_NAME = "zk-sudo-controller-service-role-prod"
    ASSUME_ROLE_POLICY_NAME = "zk-sudo-controller-service-sts-policy-prod"
  }
}

resource "aws_ssm_parameter" "lambda_admin_service_arn" {
  name  = "/${var.app_name}/${var.environment}/services/lambda/${var.lambda_name}/arn"
  type  = "String"
  value = module.lambda_admin_service.lambda_arn
}

resource "aws_ssm_parameter" "lambda_admin_service_name" {
  name  = "/${var.app_name}/${var.environment}/services/lambda/${var.lambda_name}/name"
  type  = "String"
  value = module.lambda_admin_service.lambda_name
}

