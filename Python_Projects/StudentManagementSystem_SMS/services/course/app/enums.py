from enum import Enum


class CourseStatus(str, Enum):
    DRAFT = "DRAFT"
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    ARCHIVED = "ARCHIVED"


class TeacherRole(str, Enum):
    LEAD = "LEAD"
    ASSISTANT = "ASSISTANT"
