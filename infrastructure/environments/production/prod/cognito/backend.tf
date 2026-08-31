terraform {
  backend "s3" {
    bucket         = "zk-sudo-terraform-states-bucket-prod"
    key            = "prod/cognito/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "zk-sudo-terraform-lock-table-prod"
    encrypt        = true
  }
}