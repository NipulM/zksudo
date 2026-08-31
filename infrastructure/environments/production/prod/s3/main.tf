provider "aws" {
  region = "us-east-1"
  profile = "nipulm-personal"
}

module "circuit_artifacts" {
  source = "./circuit-artifacts"
}