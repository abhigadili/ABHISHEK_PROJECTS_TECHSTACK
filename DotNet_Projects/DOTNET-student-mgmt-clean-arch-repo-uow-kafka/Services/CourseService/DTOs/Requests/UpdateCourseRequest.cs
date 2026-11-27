namespace StudentMgmt.CourseService.DTOs.Requests;

public class UpdateCourseRequest
{
    public string CourseCode { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Description { get; set; } = default!;
    public int Credits { get; set; }
    public int Capacity { get; set; }
    public string InstructorName { get; set; } = default!;
}
