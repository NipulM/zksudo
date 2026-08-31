// auth
data "aws_ssm_parameter" "cognito_admin_pool_client_id" {
  name = "/${var.app_name}/${var.environment}/cognito/admin-pool-client-id"
}

data "aws_ssm_parameter" "cognito_admin_pool_issuer" {
  name = "/${var.app_name}/${var.environment}/cognito/admin-pool-issuer"
}

// lambdas 
data "aws_ssm_parameter" "lambda_controller_service_arn" {
  name = "/${var.app_name}/${var.environment}/services/lambda/controller-service/arn"
}

data "aws_ssm_parameter" "lambda_controller_service_name" {
  name = "/${var.app_name}/${var.environment}/services/lambda/controller-service/name"
}


data "aws_ssm_parameter" "lambda_admin_service_arn" {
  name = "/${var.app_name}/${var.environment}/services/lambda/admin-service/arn"
}

data "aws_ssm_parameter" "lambda_admin_service_name" {
  name = "/${var.app_name}/${var.environment}/services/lambda/admin-service/name"
}

