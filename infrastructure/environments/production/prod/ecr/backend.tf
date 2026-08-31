terraform {
  backend "s3" {
    bucket         = "zk-sudo-terraform-states-bucket-prod"
    key            = "prod/ecr/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "zk-sudo-terraform-lock-table-prod"
    profile        = "nipulm-personal"
    encrypt        = true
  }
}
