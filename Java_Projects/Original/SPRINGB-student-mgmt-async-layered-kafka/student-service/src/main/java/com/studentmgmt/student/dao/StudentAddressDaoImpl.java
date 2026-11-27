package com.studentmgmt.student.dao;

import com.studentmgmt.student.model.StudentAddress;
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
public class StudentAddressDaoImpl implements StudentAddressDao {

    private final JdbcTemplate jdbcTemplate;

    public StudentAddressDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static StudentAddress mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        StudentAddress address = new StudentAddress();
        address.setAddressId(rs.getLong("address_id"));
        address.setStudentId(rs.getLong("student_id"));
        address.setAddressType(rs.getString("address_type"));
        address.setAddressLine1(rs.getString("address_line1"));
        address.setAddressLine2(rs.getString("address_line2"));
        address.setCity(rs.getString("city"));
        address.setState(rs.getString("state"));
        address.setPostalCode(rs.getString("postal_code"));
        address.setCountry(rs.getString("country"));
        return address;
    }

    @Override
    public List<StudentAddress> findAll() {
        return jdbcTemplate.query("SELECT * FROM Student_Address ORDER BY address_id", StudentAddressDaoImpl::mapRow);
    }

    @Override
    public List<StudentAddress> findByStudentId(Long studentId) {
        return jdbcTemplate.query(
                "SELECT * FROM Student_Address WHERE student_id = ? ORDER BY address_id",
                StudentAddressDaoImpl::mapRow, studentId);
    }

    @Override
    public Optional<StudentAddress> findById(Long addressId) {
        try {
            StudentAddress address = jdbcTemplate.queryForObject(
                    "SELECT * FROM Student_Address WHERE address_id = ?", StudentAddressDaoImpl::mapRow, addressId);
            return Optional.ofNullable(address);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public StudentAddress save(StudentAddress address) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Student_Address (student_id, address_type, address_line1, address_line2, city, state, postal_code, country) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, address.getStudentId());
            ps.setString(2, address.getAddressType());
            ps.setString(3, address.getAddressLine1());
            ps.setString(4, address.getAddressLine2());
            ps.setString(5, address.getCity());
            ps.setString(6, address.getState());
            ps.setString(7, address.getPostalCode());
            ps.setString(8, address.getCountry());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public StudentAddress update(Long addressId, StudentAddress address) {
        jdbcTemplate.update(
                "UPDATE Student_Address SET address_type = ?, address_line1 = ?, address_line2 = ?, " +
                        "city = ?, state = ?, postal_code = ?, country = ? WHERE address_id = ?",
                address.getAddressType(), address.getAddressLine1(), address.getAddressLine2(),
                address.getCity(), address.getState(), address.getPostalCode(), address.getCountry(), addressId);
        return findById(addressId).orElseThrow();
    }

    @Override
    public void deleteById(Long addressId) {
        jdbcTemplate.update("DELETE FROM Student_Address WHERE address_id = ?", addressId);
    }
}
