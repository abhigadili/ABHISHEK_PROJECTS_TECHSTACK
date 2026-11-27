package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.StudentDocument;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Repository;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Optional;

@Repository
public class StudentDocumentDaoImpl implements StudentDocumentDao {

    private final JdbcTemplate jdbcTemplate;

    public StudentDocumentDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static StudentDocument mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        StudentDocument document = new StudentDocument();
        document.setDocumentId(rs.getLong("document_id"));
        document.setStudentId(rs.getLong("student_id"));
        document.setDocumentType(rs.getString("document_type"));
        document.setDocumentNumber(rs.getString("document_number"));
        document.setFilePath(rs.getString("file_path"));
        java.sql.Timestamp uploadedAt = rs.getTimestamp("uploaded_at");
        document.setUploadedAt(uploadedAt != null ? uploadedAt.toLocalDateTime() : null);
        return document;
    }

    @Override
    public List<StudentDocument> findAll() {
        return jdbcTemplate.query("SELECT * FROM Student_Documents ORDER BY document_id", StudentDocumentDaoImpl::mapRow);
    }

    @Override
    public List<StudentDocument> findByStudentId(Long studentId) {
        return jdbcTemplate.query(
                "SELECT * FROM Student_Documents WHERE student_id = ? ORDER BY document_id",
                StudentDocumentDaoImpl::mapRow, studentId);
    }

    @Override
    public Optional<StudentDocument> findById(Long documentId) {
        try {
            StudentDocument document = jdbcTemplate.queryForObject(
                    "SELECT * FROM Student_Documents WHERE document_id = ?", StudentDocumentDaoImpl::mapRow, documentId);
            return Optional.ofNullable(document);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public StudentDocument save(StudentDocument document) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Student_Documents (student_id, document_type, document_number, file_path) " +
                            "VALUES (?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, document.getStudentId());
            ps.setString(2, document.getDocumentType());
            ps.setString(3, document.getDocumentNumber());
            ps.setString(4, document.getFilePath());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public void deleteById(Long documentId) {
        jdbcTemplate.update("DELETE FROM Student_Documents WHERE document_id = ?", documentId);
    }
}
