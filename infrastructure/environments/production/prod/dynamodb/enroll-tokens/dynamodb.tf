# update - t3 (enrol-tokens table: an admin mints a single-use, short-TTL token
# out-of-band; the developer presents it once at `devs enroll`. DynamoDB TTL
# reaps expired tokens; single-use is enforced by the gateway flipping used=true.)

resource "aws_dynamodb_table" "enroll_tokens" {
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

resource "aws_ssm_parameter" "enroll_tokens_table_name" {
  name  = "/${var.app_name}/${var.environment}/databases/${var.table_name}/name"
  type  = "String"
  value = aws_dynamodb_table.enroll_tokens.name
}

resource "aws_ssm_parameter" "enroll_tokens_table_arn" {
  name  = "/${var.app_name}/${var.environment}/databases/${var.table_name}/arn"
  type  = "String"
  value = aws_dynamodb_table.enroll_tokens.arn
}
