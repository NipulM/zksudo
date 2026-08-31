data "aws_caller_identity" "current" {}

locals {
  controller_role_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/zk-sudo-controller-service-role-prod"
}

resource "aws_iam_policy" "lambda_iam_self_manage_policy" {
  name        = "${var.app_name}-${var.lambda_name}-iam-self-manage-policy-${var.environment}"
  description = "Allows admin-service to read/write the AssumeRole inline policy on the controller's execution role"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iam:GetRolePolicy", "iam:PutRolePolicy"]
        Resource = local.controller_role_arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_iam_self_manage_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_iam_self_manage_policy.arn
}

resource "aws_iam_role" "lambda_role" {
  name = "${var.app_name}-${var.lambda_name}-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "lambda_cloudwatch_policy" {
  name        = "${var.app_name}-${var.lambda_name}-cloudwatch-policy-${var.environment}"
  description = "${var.app_name} IAM policy for Lambda to write logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_dynamodb_policy" {
  name        = "${var.app_name}-${var.lambda_name}-dynamodb-policy-${var.environment}"
  description = "IAM policy for admin-service to access dynamodb"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "dynamodb:*"
        Resource = data.aws_ssm_parameter.enroll_tokens_dynamodb_arn.value
      }
    ]
  })
}


resource "aws_iam_role_policy_attachment" "lambda_cloudwatch_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_cloudwatch_policy.arn
}

resource "aws_iam_role_policy_attachment" "lambda_dynamodb_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_dynamodb_policy.arn
}