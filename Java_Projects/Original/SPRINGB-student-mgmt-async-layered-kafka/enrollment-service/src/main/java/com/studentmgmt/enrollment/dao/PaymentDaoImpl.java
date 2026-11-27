package com.studentmgmt.enrollment.dao;

import com.studentmgmt.enrollment.model.Payment;
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
public class PaymentDaoImpl implements PaymentDao {

    private final JdbcTemplate jdbcTemplate;

    public PaymentDaoImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static Payment mapRow(ResultSet rs, int rowNum) throws java.sql.SQLException {
        Payment payment = new Payment();
        payment.setPaymentId(rs.getLong("payment_id"));
        payment.setEnrollmentId(rs.getLong("enrollment_id"));
        payment.setAmount(rs.getBigDecimal("amount"));
        payment.setPaymentMethod(rs.getString("payment_method"));
        payment.setPaymentStatus(rs.getString("payment_status"));
        payment.setTransactionRef(rs.getString("transaction_ref"));
        java.sql.Timestamp paymentDate = rs.getTimestamp("payment_date");
        payment.setPaymentDate(paymentDate != null ? paymentDate.toLocalDateTime() : null);
        return payment;
    }

    @Override
    public List<Payment> findAll() {
        return jdbcTemplate.query("SELECT * FROM Payments ORDER BY payment_id", PaymentDaoImpl::mapRow);
    }

    @Override
    public List<Payment> findByEnrollmentId(Long enrollmentId) {
        return jdbcTemplate.query(
                "SELECT * FROM Payments WHERE enrollment_id = ? ORDER BY payment_id",
                PaymentDaoImpl::mapRow, enrollmentId);
    }

    @Override
    public Optional<Payment> findById(Long paymentId) {
        try {
            Payment payment = jdbcTemplate.queryForObject(
                    "SELECT * FROM Payments WHERE payment_id = ?", PaymentDaoImpl::mapRow, paymentId);
            return Optional.ofNullable(payment);
        } catch (EmptyResultDataAccessException e) {
            return Optional.empty();
        }
    }

    @Override
    public Payment save(Payment payment) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement ps = connection.prepareStatement(
                    "INSERT INTO Payments (enrollment_id, amount, payment_method, payment_status, transaction_ref) " +
                            "VALUES (?, ?, ?, ?, ?)",
                    Statement.RETURN_GENERATED_KEYS);
            ps.setLong(1, payment.getEnrollmentId());
            ps.setBigDecimal(2, payment.getAmount());
            ps.setString(3, payment.getPaymentMethod());
            ps.setString(4, payment.getPaymentStatus() != null ? payment.getPaymentStatus() : "PENDING");
            ps.setString(5, payment.getTransactionRef());
            return ps;
        }, keyHolder);

        Long newId = keyHolder.getKey().longValue();
        return findById(newId).orElseThrow();
    }

    @Override
    public Payment updateStatus(Long paymentId, String status) {
        jdbcTemplate.update("UPDATE Payments SET payment_status = ? WHERE payment_id = ?", status, paymentId);
        return findById(paymentId).orElseThrow();
    }
}
