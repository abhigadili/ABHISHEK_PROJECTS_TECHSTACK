using Common.Paging;
using Microsoft.EntityFrameworkCore;
using StudentService.Data;
using StudentService.Entities;

namespace StudentService.Repositories;

public interface IStudentRepository
{
    Task<Student?> FindAsync(long id, CancellationToken ct = default);
    Task<bool> EmailExistsAsync(string email, long? exceptId, CancellationToken ct = default);
    Task AddAsync(Student s, CancellationToken ct = default);
    void Remove(Student s);
    Task<PagedResult<Student>> SearchAsync(string? search, StudentStatus? status, Gender? gender, PageRequest page, CancellationToken ct = default);
    Task SaveAsync(CancellationToken ct = default);
}

public class StudentRepository(StudentDbContext db) : IStudentRepository
{
    public Task<Student?> FindAsync(long id, CancellationToken ct = default) => db.Students.FirstOrDefaultAsync(s => s.StudentId == id, ct);

    public Task<bool> EmailExistsAsync(string email, long? exceptId, CancellationToken ct = default)
    {
        var e = email.Trim().ToLower();
        return db.Students.AnyAsync(s => s.Email.ToLower() == e && (exceptId == null || s.StudentId != exceptId), ct);
    }

    public async Task AddAsync(Student s, CancellationToken ct = default) => await db.Students.AddAsync(s, ct);
    public void Remove(Student s) => db.Students.Remove(s);
    public Task SaveAsync(CancellationToken ct = default) => db.SaveChangesAsync(ct);

    public async Task<PagedResult<Student>> SearchAsync(string? search, StudentStatus? status, Gender? gender, PageRequest page, CancellationToken ct = default)
    {
        IQueryable<Student> q = db.Students.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var like = search.Trim().ToLower();
            q = q.Where(s => s.FirstName.ToLower().Contains(like) || s.LastName.ToLower().Contains(like) || s.Email.ToLower().Contains(like));
        }
        if (status != null) q = q.Where(s => s.Status == status);
        if (gender != null) q = q.Where(s => s.Gender == gender);
        var total = await q.LongCountAsync(ct);
        var items = await q.OrderByName(page.SortBy, page.Descending).ThenBy(s => s.StudentId).Skip(page.Page * page.Size).Take(page.Size).ToListAsync(ct);
        return new PagedResult<Student>(items, page.Page, page.Size, total, (int)Math.Ceiling(total / (double)page.Size));
    }
}
