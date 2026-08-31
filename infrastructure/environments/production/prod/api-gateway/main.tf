provider "aws" {
  region = "us-east-1"
  profile = "nipulm-personal"
}

module "zk_sudo_api_gw" {
  source = "./zk-sudo-api-gw"
}

