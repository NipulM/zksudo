module "circuit_artifacts" {
  source        = "../../../../../modules/s3"
  name          = "${var.app_name}-${var.s3_bucket_name}-${var.environment}"
  force_destroy = true

  additional_tags = var.additional_tags
}


resource "aws_ssm_parameter" "circuit_artifacts_bucket_arn" {
  name  = "/${var.app_name}/${var.environment}/s3/circuit-artifacts/arn"
  type  = "String"
  value = module.circuit_artifacts.bucket_arn
}

resource "aws_ssm_parameter" "circuit_artifacts_bucket_id" {
  name  = "/${var.app_name}/${var.environment}/s3/circuit-artifacts/name"
  type  = "String"
  value = module.circuit_artifacts.bucket_name
}