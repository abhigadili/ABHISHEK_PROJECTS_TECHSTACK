using AutoMapper;
using StudentMgmt.CourseService.DTOs.Responses;
using StudentMgmt.CourseService.Entities;

namespace StudentMgmt.CourseService.Mappings;

public class CourseProfile : Profile
{
    public CourseProfile()
    {
        CreateMap<Course, CourseResponse>();
    }
}
