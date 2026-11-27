from enum import Enum


class StudentStatus(str, Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    SUSPENDED = "SUSPENDED"
    GRADUATED = "GRADUATED"


class Gender(str, Enum):
    MALE = "MALE"
    FEMALE = "FEMALE"
    OTHER = "OTHER"


class ContactType(str, Enum):
    PHONE = "PHONE"
    ALTERNATE_EMAIL = "ALTERNATE_EMAIL"
    EMERGENCY = "EMERGENCY"


class FileKind(str, Enum):
    PROFILE_PICTURE = "PROFILE_PICTURE"
    DOCUMENT = "DOCUMENT"
