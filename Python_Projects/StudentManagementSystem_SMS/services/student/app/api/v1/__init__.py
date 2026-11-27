from fastapi import APIRouter

from app.api.v1 import departments, files, students

api_router = APIRouter()
api_router.include_router(departments.router)
api_router.include_router(students.router)
api_router.include_router(files.router)
