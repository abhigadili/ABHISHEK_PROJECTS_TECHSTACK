package com.studentmgmt.notification.controller;

import com.studentmgmt.notification.service.SimulatedExternalGateway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(NotificationAdminController.class)
class NotificationAdminControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private SimulatedExternalGateway simulatedExternalGateway;

    @Test
    void toggleFailureSetsExplicitValueWhenProvided() throws Exception {
        mockMvc.perform(post("/api/notifications/admin/toggle-failure").param("failing", "true"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.simulatedGatewayFailing").value(true));

        verify(simulatedExternalGateway).setForcedFailure(true);
    }
}
