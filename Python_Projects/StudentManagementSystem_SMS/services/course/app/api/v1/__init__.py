from fastapi import APIRouter

from app.api.v1 import categories, courses

api_router = APIRouter()
api_router.include_router(categories.router)
api_router.include_router(courses.router)
api_router.include_router(courses.files_router)
