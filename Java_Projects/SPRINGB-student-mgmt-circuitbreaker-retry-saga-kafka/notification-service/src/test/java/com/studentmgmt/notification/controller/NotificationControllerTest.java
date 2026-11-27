package com.studentmgmt.notification.controller;

import com.studentmgmt.notification.entity.Notification;
import com.studentmgmt.notification.repository.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(NotificationController.class)
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private NotificationRepository notificationRepository;

    @Test
    void findByEnrollmentIdFiltersWhenQueryParamPresent() throws Exception {
        Notification n = new Notification();
        n.setNotificationId(1L);
        n.setEnrollmentId(37L);
        n.setChannel(Notification.Channel.EMAIL);
        n.setStatus(Notification.Status.SENT);
        when(notificationRepository.findByEnrollmentId(37L)).thenReturn(List.of(n));

        mockMvc.perform(get("/api/notifications").param("enrollmentId", "37"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].enrollmentId").value(37))
                .andExpect(jsonPath("$[0].status").value("SENT"));
    }

    @Test
    void getByIdReturns404WhenMissing() throws Exception {
        when(notificationRepository.findById(99L)).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/notifications/99"))
                .andExpect(status().isNotFound());
    }
}
