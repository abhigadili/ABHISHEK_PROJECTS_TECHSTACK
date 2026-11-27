namespace StudentMgmt.EnrollmentService.DTOs.Requests;

public class EnrollStudentRequest
{
    public Guid StudentId { get; set; }
    public Guid CourseId { get; set; }
}
