

resource "aws_dynamodb_table" "users" {
  name         = "${var.app_name}-${var.table_name}-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  hash_key  = "PK"
  range_key = "SK"


  tags = {
    Name        = "${var.table_name}-${var.environment}"
    Environment = var.environment
  }

  deletion_protection_enabled = true
}

resource "aws_ssm_parameter" "users_table_name" {
  name  = "/${var.app_name}/${var.environment}/databases/${var.table_name}/name"
  type  = "String"
  value = aws_dynamodb_table.users.name
}

resource "aws_ssm_parameter" "users_table_arn" {
  name  = "/${var.app_name}/${var.environment}/databases/${var.table_name}/arn"
  type  = "String"
  value = aws_dynamodb_table.users.arn
}
