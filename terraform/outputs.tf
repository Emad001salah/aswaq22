output "cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "ecr_repository_url" {
  description = "ECR repository URL for pushing images"
  value       = aws_ecr_repository.server.repository_url
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.postgres.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive   = true
}

output "s3_uploads_bucket" {
  description = "S3 bucket name for user uploads"
  value       = aws_s3_bucket.uploads.id
}

output "secrets_manager_arn" {
  description = "ARN of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.app.arn
}

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}
