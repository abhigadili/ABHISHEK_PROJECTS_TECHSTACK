using Common.Errors;
using CourseService.Dtos;
using CourseService.Entities;
using CourseService.Repositories;

namespace CourseService.Services;

public class CategoryAppService(ICategoryRepository repo, ICourseRepository courses)
{
    public async Task<CategoryResponse> CreateAsync(CategoryRequest r, CancellationToken ct)
    {
        if (await repo.NameExistsAsync(r.Name, ct)) throw new ConflictException($"Category '{r.Name}' already exists");
        var c = new CourseCategory { Name = r.Name.Trim(), Description = r.Description };
        await repo.AddAsync(c, ct); await repo.SaveAsync(ct);
        return ToResponse(c);
    }

    public async Task<List<CategoryResponse>> ListAsync(CancellationToken ct) => (await repo.ListAsync(ct)).Select(ToResponse).ToList();

    public async Task<CategoryResponse> UpdateAsync(long id, CategoryRequest r, CancellationToken ct)
    {
        var c = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Category {id} not found");
        if (!c.Name.Equals(r.Name.Trim(), StringComparison.OrdinalIgnoreCase) && await repo.NameExistsAsync(r.Name, ct)) throw new ConflictException($"Category '{r.Name}' already exists");
        c.Name = r.Name.Trim(); c.Description = r.Description;
        await repo.SaveAsync(ct);
        return ToResponse(c);
    }

    public async Task DeleteAsync(long id, CancellationToken ct)
    {
        var c = await repo.FindAsync(id, ct) ?? throw new NotFoundException($"Category {id} not found");
        if (await courses.CategoryInUseAsync(id, ct)) throw new ConflictException("Category is used by existing courses");
        repo.Remove(c); await repo.SaveAsync(ct);
    }

    private static CategoryResponse ToResponse(CourseCategory c) => new(c.CategoryId, c.Name, c.Description);
}
