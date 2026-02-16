import enum


class RoleEnum(str, enum.Enum):
    admin = "admin"
    member = "member"
    viewer = "viewer"


class EnvironmentEnum(str, enum.Enum):
    local = "local"
    dev = "dev"
    prod = "prod"


class SecretTypeEnum(str, enum.Enum):
    key = "key"
    token = "token"
    endpoint = "endpoint"
