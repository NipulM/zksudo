
resource "aws_cloudwatch_log_group" "api_gateway_logs" {
  name              = "/aws/apigateway/${var.app_name}-http-api-gateway-${var.environment}"
  retention_in_days = 14
}

resource "aws_apigatewayv2_api" "zk_sudo_api_gw_http_api" {

  cors_configuration {
    allow_origins     = ["*"]
    allow_methods     = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
    allow_headers     = ["authorization", "content-type", "x-requested-with"]
    expose_headers    = ["*"]
    allow_credentials = false
    max_age           = 86400
  }

  name          = "${var.app_name}-http-api-gateway-${var.environment}"
  description   = "${var.app_name} HTTP API Gateway - ${var.environment}"
  protocol_type = "HTTP"

  body = templatefile("${path.module}/${var.api_yml_path}", {
    controller_service_uri = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.aws_ssm_parameter.lambda_controller_service_arn.value}/invocations",
    admin_service_uri = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/${data.aws_ssm_parameter.lambda_admin_service_arn.value}/invocations",
    cognito_issuer    = data.aws_ssm_parameter.cognito_admin_pool_issuer.value,
    cognito_client_id = data.aws_ssm_parameter.cognito_admin_pool_client_id.value
  })
}

resource "aws_apigatewayv2_stage" "zk_sudo_api_gw_default" {
  api_id      = aws_apigatewayv2_api.zk_sudo_api_gw_http_api.id
  name        = "$default"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway_logs.arn
    format = jsonencode({
      requestId         = "$context.requestId"
      extendedRequestId = "$context.extendedRequestId"
      ip                = "$context.identity.sourceIp"
      caller            = "$context.identity.caller"
      user              = "$context.identity.user"
      requestTime       = "$context.requestTime"
      httpMethod        = "$context.httpMethod"
      resourcePath      = "$context.resourcePath"
      status            = "$context.status"
      protocol          = "$context.protocol"
      responseLength    = "$context.responseLength"
      error             = "$context.error.message"
      errorType         = "$context.error.messageString"
      integrationError  = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_ssm_parameter" "api_gateway_zk_sudo_api_gw_id" {
  name  = "/${var.app_name}/${var.environment}/services/api-gateway/zk_sudo_api_gw/id"
  type  = "String"
  value = aws_apigatewayv2_api.zk_sudo_api_gw_http_api.id
}

resource "aws_ssm_parameter" "api_gateway_zk_sudo_api_gw_execution_arn" {
  name  = "/${var.app_name}/${var.environment}/services/api-gateway/zk_sudo_api_gw/execution-arn"
  type  = "String"
  value = aws_apigatewayv2_api.zk_sudo_api_gw_http_api.execution_arn
}

resource "aws_ssm_parameter" "api_gateway_zk_sudo_api_gw_stage_url" {
  name  = "/${var.app_name}/${var.environment}/services/api-gateway/zk_sudo_api_gw/stage-url"
  type  = "String"
  value = aws_apigatewayv2_stage.zk_sudo_api_gw_default.invoke_url
}
