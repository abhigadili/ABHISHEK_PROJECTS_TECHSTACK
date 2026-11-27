using AutoMapper;
using StudentMgmt.NotificationService.DTOs.Responses;
using StudentMgmt.NotificationService.Entities;

namespace StudentMgmt.NotificationService.Mappings;

public class NotificationProfile : Profile
{
    public NotificationProfile()
    {
        CreateMap<NotificationHistory, NotificationHistoryResponse>();
    }
}
