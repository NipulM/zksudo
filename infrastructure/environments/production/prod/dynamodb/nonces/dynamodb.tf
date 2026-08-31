

resource "aws_dynamodb_table" "nonces" {
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

  # update - t3 (native DynamoDB TTL: nonces are single-use, short-lived
  # challenges; DynamoDB auto-deletes expired rows. Security is still enforced
  # at read time in the gateway, since TTL deletion is delayed/best-effort.)
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = {
    Name        = "${var.table_name}-${var.environment}"
    Environment = var.environment
  }

  deletion_protection_enabled = true
}

resource "aws_ssm_parameter" "nonces_table_name" {
  name  = "/${var.app_name}/${var.environment}/databases/${var.table_name}/name"
  type  = "String"
  value = aws_dynamodb_table.nonces.name
}

resource "aws_ssm_parameter" "nonces_table_arn" {
  name  = "/${var.app_name}/${var.environment}/databases/${var.table_name}/arn"
  type  = "String"
  value = aws_dynamodb_table.nonces.arn
}
