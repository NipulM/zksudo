terraform {
  required_providers {
    aws = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "aws" { region = "us-east-1" }

resource "random_id" "suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "demo" {
  bucket = "devs-demo-bucketv100"


  tags = {
    DeployedBy = "devs-zkp"
    Purpose    = "FYP-demo"
  }
}

output "bucket_name" {
  value = aws_s3_bucket.demo.id
}