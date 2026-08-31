provider "aws" {
  region = "us-east-1"
  profile = "nipulm-personal"
}

module "controller_service" {
  source = "./controller-service"
}

module "admin_service" {
  source = "./admin-service"
}