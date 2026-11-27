using AutoMapper;
using StudentMgmt.EnrollmentService.DTOs.Responses;
using StudentMgmt.EnrollmentService.Entities;

namespace StudentMgmt.EnrollmentService.Mappings;

/// <summary>
/// Maps the fields Enrollment itself owns straight across. StudentFullName and
/// CourseTitle are NOT sourced here — Enrollment has no navigation property to
/// StudentSnapshot/CourseSnapshot (they are looked up independently), so
/// EnrollmentAppService populates those two fields manually after this mapping
/// runs, by reading the two snapshots it already had to load to validate the
/// request in the first place.
/// </summary>
public class EnrollmentProfile : Profile
{
    public EnrollmentProfile()
    {
        CreateMap<Enrollment, EnrollmentResponse>()
            .ForMember(dest => dest.StudentFullName, opt => opt.Ignore())
            .ForMember(dest => dest.CourseTitle, opt => opt.Ignore());
    }
}
