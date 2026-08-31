resource "aws_s3_bucket" "this" {
  bucket        = var.name
  force_destroy = var.force_destroy

  tags = merge(
    var.additional_tags,
    {
      "BaseName" = var.name
    },
  )
}

resource "aws_s3_bucket_public_access_block" "blockall" {
  bucket                  = aws_s3_bucket.this.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}


resource "aws_s3_bucket_ownership_controls" "host_ownership" {
  bucket = aws_s3_bucket.this.id
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_acl" "host_acl" {
  depends_on = [aws_s3_bucket_ownership_controls.host_ownership]

  bucket = aws_s3_bucket.this.id
  acl    = "private"
}
