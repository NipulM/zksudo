variable "name" {
  type = string
}

variable "force_destroy" {
  type    = bool
  default = false
}


variable "versioning" {
  type    = bool
  default = false
}


variable "additional_tags" {
  default     = {}
  description = "Additional resource tags"
  type        = map(string)
}

variable "account_id" {
  type    = string
  default = "258395060961"
}