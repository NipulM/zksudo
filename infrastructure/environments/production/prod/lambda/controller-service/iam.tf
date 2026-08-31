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
  description = "IAM policy for controller-service to access dynamodb"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = "dynamodb:*"
        Resource = data.aws_ssm_parameter.nonces_dynamodb_arn.value
      },
      {
        Effect = "Allow"
        Action = "dynamodb:*"
        Resource = data.aws_ssm_parameter.users_dynamodb_arn.value
      },
      # update - t3 (allow the controller to read/spend enrolment tokens)
      {
        Effect = "Allow"
        Action = "dynamodb:*"
        Resource = data.aws_ssm_parameter.enroll_tokens_dynamodb_arn.value
      }
    ]
  })
}

resource "aws_iam_policy" "lambda_s3_policy" {
  name = "${var.app_name}-${var.lambda_name}-s3-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Effect   = "Allow"
        Resource = [
          "${data.aws_ssm_parameter.circuit_artifacts_bucket_arn.value}/*"
        ]
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

resource "aws_iam_role_policy_attachment" "lambda_s3_policy_attachment" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_s3_policy.arn
}