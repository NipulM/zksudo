provider "aws" {
  region = "us-east-1"
  profile = "nipulm-personal"
}

module "controller_ecr" {
  source = "./controller-ecr"
}