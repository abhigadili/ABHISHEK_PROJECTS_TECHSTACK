"""Shared library for the Student Management System microservices.

Each service imports from here instead of re-implementing cross-cutting
concerns.  The package deliberately has *no* knowledge of any service's
database models: services own their data, the library only provides the
mechanics (sessions, outbox, consumers, security dependencies...).
"""

__version__ = "1.0.0"
