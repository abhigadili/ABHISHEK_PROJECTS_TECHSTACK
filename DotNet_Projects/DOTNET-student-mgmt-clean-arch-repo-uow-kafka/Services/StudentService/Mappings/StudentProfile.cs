using AutoMapper;
using StudentMgmt.StudentService.DTOs.Responses;
using StudentMgmt.StudentService.Entities;

namespace StudentMgmt.StudentService.Mappings;

public class StudentProfile : Profile
{
    public StudentProfile()
    {
        CreateMap<Student, StudentResponse>();
    }
}
