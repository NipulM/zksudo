resource "aws_cognito_user_pool" "admin_pool" {
  name = "${var.app_name}-admin-pool-${var.environment}"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_uppercase = true
    require_numbers   = true
    require_symbols   = false
  }

  mfa_configuration = "OFF"

  schema {
    name                 = "email"
    attribute_data_type  = "String"
    required             = true
    mutable              = true
  }

  lifecycle {
    ignore_changes = [schema]
  }
}

resource "aws_cognito_user_pool_client" "admin_pool_client" {
  name         = "${var.app_name}-admin-pool-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.admin_pool.id

  explicit_auth_flows = ["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  generate_secret     = false
}

resource "aws_ssm_parameter" "admin_pool_id" {
  name      = "/${var.app_name}/${var.environment}/cognito/admin-pool-id"
  type      = "String"
  value     = aws_cognito_user_pool.admin_pool.id
  overwrite = true
}

resource "aws_ssm_parameter" "admin_pool_arn" {
  name      = "/${var.app_name}/${var.environment}/cognito/admin-pool-arn"
  type      = "String"
  value     = aws_cognito_user_pool.admin_pool.arn
  overwrite = true
}

resource "aws_ssm_parameter" "admin_pool_client_id" {
  name      = "/${var.app_name}/${var.environment}/cognito/admin-pool-client-id"
  type      = "String"
  value     = aws_cognito_user_pool_client.admin_pool_client.id
  overwrite = true
}

resource "aws_ssm_parameter" "admin_pool_issuer" {
  name      = "/${var.app_name}/${var.environment}/cognito/admin-pool-issuer"
  type      = "String"
  value     = "https://${aws_cognito_user_pool.admin_pool.endpoint}"
  overwrite = true
}