resource "aws_ecr_repository" "controller_repository" {
  name                 = "${var.app_name}-${var.ecr_name}-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ssm_parameter" "controller_repository_arn" {
  name      = "/${var.app_name}/${var.environment}/ecr/${var.ecr_name}/repository-arn"
  type      = "String"
  value     = aws_ecr_repository.controller_repository.arn
  overwrite = true
}

resource "aws_ssm_parameter" "controller_repository_url" {
  name      = "/${var.app_name}/${var.environment}/ecr/${var.ecr_name}/repository-url"
  type      = "String"
  value     = aws_ecr_repository.controller_repository.repository_url
  overwrite = true
}

