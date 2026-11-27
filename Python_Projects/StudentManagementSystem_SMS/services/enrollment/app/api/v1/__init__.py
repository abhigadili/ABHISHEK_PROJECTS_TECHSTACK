from fastapi import APIRouter

from app.api.v1 import enrollments

api_router = APIRouter()
api_router.include_router(enrollments.router)
