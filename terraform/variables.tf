variable "aws_region" {
  type        = string
  description = "AWS region to deploy resources into"
  default     = "me-south-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment (staging | production)"
  default     = "production"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "cluster_name" {
  type        = string
  description = "EKS cluster name"
  default     = "aswaq-cluster"
}

variable "cluster_version" {
  type        = string
  description = "Kubernetes version"
  default     = "1.29"
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the VPC"
  default     = "10.0.0.0/16"
}

variable "private_subnets" {
  type        = list(string)
  description = "Private subnet CIDR blocks"
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  type        = list(string)
  description = "Public subnet CIDR blocks"
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class"
  default     = "db.t4g.medium"
}

variable "db_name" {
  type        = string
  description = "PostgreSQL database name"
  default     = "aswaq"
}

variable "db_username" {
  type        = string
  description = "PostgreSQL master username"
  default     = "aswaq_admin"
  sensitive   = true
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache Redis node type"
  default     = "cache.t4g.small"
}

variable "ecr_repository_name" {
  type        = string
  description = "ECR repository name for the server image"
  default     = "aswaq/server"
}

variable "app_image_tag" {
  type        = string
  description = "Docker image tag to deploy"
  default     = "latest"
}

variable "domain_name" {
  type        = string
  description = "Root domain for the application"
  default     = "aswaq.sa"
}
