resource "aws_iam_role" "api_gateway_role" {
  name = "${var.app_name}-http-api-gateway-cloudwatch-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

# Attach AWS managed policy for CloudWatch Logs
resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch_logs" {
  role       = aws_iam_role.api_gateway_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

resource "aws_lambda_permission" "allow_controller_service_invoke" {
  statement_id  = "AllowExecutionFromAPIGateway-controller-service"
  action        = "lambda:InvokeFunction"
  function_name = data.aws_ssm_parameter.lambda_controller_service_name.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.zk_sudo_api_gw_http_api.execution_arn}/*/*"
}

resource "aws_lambda_permission" "allow_admin_service_invoke" {
  statement_id  = "AllowExecutionFromAPIGateway-admin-service"
  action        = "lambda:InvokeFunction"
  function_name = data.aws_ssm_parameter.lambda_admin_service_name.value
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.zk_sudo_api_gw_http_api.execution_arn}/*/*"
}
