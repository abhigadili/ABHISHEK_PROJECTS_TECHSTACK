package com.hrportal.timesheet.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hrportal.common.audit.AuditService;
import com.hrportal.common.exception.ConflictException;
import com.hrportal.common.persistence.BeanMapper;
import com.hrportal.common.persistence.CrudService;
import com.hrportal.timesheet.dto.TimesheetDtos.TaskRequest;
import com.hrportal.timesheet.dto.TimesheetDtos.TaskResponse;
import com.hrportal.timesheet.entity.TimesheetTask;
import com.hrportal.timesheet.repository.TimesheetRepositories.TaskRepository;

@Service
public class TaskService extends CrudService<TimesheetTask, TaskRequest, TaskResponse> {
    private final TaskRepository tasks;

    public TaskService(TaskRepository tasks, AuditService audit) {
        super(tasks, audit, TimesheetTask.class, TaskResponse.class);
        this.tasks = tasks;
    }

    @Override
    protected void beforeCreate(TimesheetTask t, TaskRequest r) {
        if (tasks.existsByProjectIdAndCodeIgnoreCase(r.projectId(), r.code())) throw new ConflictException("Task code already exists in this project: " + r.code());
        t.setCode(r.code().toUpperCase());
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> forProject(String projectId) {
        return BeanMapper.toRecords(tasks.findByProjectIdAndActiveTrueOrderByName(projectId), TaskResponse.class);
    }
}
