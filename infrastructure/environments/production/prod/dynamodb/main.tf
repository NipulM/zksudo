provider "aws" {
  region = "us-east-1"
  profile = "nipulm-personal"
}

module "users" {
  source = "./users"
}

module "nonces" {
  source = "./nonces"
}

# update - t3 (bootstrap enrolment tokens table)
module "enroll_tokens" {
  source = "./enroll-tokens"
}

