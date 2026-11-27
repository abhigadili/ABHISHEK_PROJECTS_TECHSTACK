package com.example.student.it;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class StudentApiIT extends AbstractIT {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired JdbcTemplate jdbc;
    @Autowired StringRedisTemplate redis;

    private String login(String user, String pw) throws Exception {
        String body = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"" + user + "\",\"password\":\"" + pw + "\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(body).get("accessToken").asText();
    }

    private String admin() throws Exception { return "Bearer " + login("admin", "Admin@123"); }

    private JsonNode createStudent(String bearer, String email) throws Exception {
        String body = mvc.perform(post("/api/students").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Asha\",\"lastName\":\"Rao\",\"email\":\"" + email + "\",\"phoneNumber\":\"+91 9876543210\",\"gender\":\"FEMALE\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return json.readTree(body);
    }

    @Test
    void flywayAddedNewTablesAndPreservedExistingData() {
        assertThat(jdbc.queryForObject("select count(*) from Students where email='legacy@example.com'", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema=database() and table_name in ('sms_students','sms_users','sms_refresh_tokens','flyway_schema_history')", Integer.class)).isEqualTo(4);
    }

    @Test
    void protectedEndpointsRequireAToken() throws Exception {
        mvc.perform(get("/api/students")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/students").header("Authorization", "Bearer garbage")).andExpect(status().isUnauthorized());
    }

    @Test
    void crudLifecycleWithRedisCacheAndEviction() throws Exception {
        String bearer = admin();
        JsonNode created = createStudent(bearer, "crud-" + UUID.randomUUID() + "@example.com");
        long id = created.get("studentId").asLong();
        String key = "sms:students::" + id;

        mvc.perform(get("/api/students/" + id).header("Authorization", bearer)).andExpect(status().isOk()).andExpect(jsonPath("$.firstName").value("Asha"));
        assertThat(redis.hasKey(key)).as("student cached after first read").isTrue();
        assertThat(redis.getExpire(key)).as("cache entry has a TTL").isPositive();

        mvc.perform(put("/api/students/" + id).header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"Asha\",\"lastName\":\"Updated\",\"email\":\"" + created.get("email").asText() + "\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/api/students/" + id).header("Authorization", bearer)).andExpect(jsonPath("$.lastName").value("Updated"));   // cache updated

        mvc.perform(patch("/api/students/" + id + "/status").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"INACTIVE\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("INACTIVE"));
        mvc.perform(get("/api/students/" + id + "/eligibility").header("Authorization", bearer)).andExpect(jsonPath("$.eligible").value(false));

        mvc.perform(delete("/api/students/" + id).header("Authorization", bearer)).andExpect(status().isNoContent());
        assertThat(redis.hasKey(key)).as("cache evicted on delete").isFalse();
        mvc.perform(get("/api/students/" + id).header("Authorization", bearer)).andExpect(status().isNotFound());
    }

    @Test
    void validationAndDuplicateErrors() throws Exception {
        String bearer = admin();
        mvc.perform(post("/api/students").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"\",\"lastName\":\"x\",\"email\":\"not-an-email\",\"phoneNumber\":\"12\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.fieldErrors.firstName").exists())
                .andExpect(jsonPath("$.fieldErrors.email").exists()).andExpect(jsonPath("$.fieldErrors.phoneNumber").exists());
        String email = "dup-" + UUID.randomUUID() + "@example.com";
        createStudent(bearer, email);
        mvc.perform(post("/api/students").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\":\"B\",\"lastName\":\"C\",\"email\":\"" + email.toUpperCase() + "\"}")).andExpect(status().isConflict());
    }

    @Test
    void searchFilterPagingAndSorting() throws Exception {
        String bearer = admin();
        String tag = UUID.randomUUID().toString().substring(0, 8);
        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/students").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON)
                    .content("{\"firstName\":\"Zed" + tag + "\",\"lastName\":\"L" + i + "\",\"email\":\"z" + i + "." + tag + "@example.com\"}")).andExpect(status().isCreated());
        }
        mvc.perform(get("/api/students?search=zed" + tag + "&size=2&page=0&sort=lastName,desc").header("Authorization", bearer))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(3)).andExpect(jsonPath("$.content.length()").value(2))
                .andExpect(jsonPath("$.content[0].lastName").value("L2"));
        mvc.perform(get("/api/students?sort=password,asc").header("Authorization", bearer)).andExpect(status().isBadRequest());   // sort whitelist
    }

    @Test
    void roleBasedAccessControl() throws Exception {
        String adminBearer = admin();
        // anonymous registration -> STUDENT with a linked student profile
        String reg = mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"stu1\",\"email\":\"stu1@example.com\",\"password\":\"Passw0rd!\",\"firstName\":\"S\",\"lastName\":\"One\"}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long ownId = json.readTree(reg).get("studentId").asLong();
        String stu = "Bearer " + login("stu1", "Passw0rd!");

        mvc.perform(get("/api/students").header("Authorization", stu)).andExpect(status().isForbidden());
        mvc.perform(get("/api/students/" + ownId).header("Authorization", stu)).andExpect(status().isOk());
        mvc.perform(get("/api/students/" + (ownId + 1000)).header("Authorization", stu)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/students/" + ownId).header("Authorization", stu)).andExpect(status().isForbidden());

        // privileged accounts only via ADMIN
        String staffBody = "{\"username\":\"staff1\",\"email\":\"staff1@example.com\",\"password\":\"Passw0rd!\",\"role\":\"STAFF\"}";
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(staffBody)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/register").header("Authorization", adminBearer).contentType(MediaType.APPLICATION_JSON).content(staffBody)).andExpect(status().isCreated());
        String staff = "Bearer " + login("staff1", "Passw0rd!");
        mvc.perform(get("/api/students").header("Authorization", staff)).andExpect(status().isOk());
        mvc.perform(delete("/api/students/" + ownId).header("Authorization", staff)).andExpect(status().isForbidden());   // delete is ADMIN-only
        mvc.perform(delete("/api/students/" + ownId).header("Authorization", adminBearer)).andExpect(status().isNoContent());
    }

    @Test
    void passwordsAreStoredAsBcryptAndRefreshTokensAsHashes() throws Exception {
        mvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"hash1\",\"email\":\"hash1@example.com\",\"password\":\"Passw0rd!\",\"firstName\":\"H\",\"lastName\":\"One\"}")).andExpect(status().isCreated());
        String loginBody = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"hash1\",\"password\":\"Passw0rd!\"}"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        String refresh = json.readTree(loginBody).get("refreshToken").asText();
        assertThat(jdbc.queryForObject("select password_hash from sms_users where username='hash1'", String.class)).startsWith("$2").doesNotContain("Passw0rd!");
        assertThat(jdbc.queryForObject("select count(*) from sms_refresh_tokens where token_hash=?", Integer.class, refresh)).isZero();

        String refreshReq = "{\"refreshToken\":\"" + refresh + "\"}";
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(refreshReq)).andExpect(status().isOk());
        mvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(refreshReq)).andExpect(status().isUnauthorized());   // rotated
    }
}
