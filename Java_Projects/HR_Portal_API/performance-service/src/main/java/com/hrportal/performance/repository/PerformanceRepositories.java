package com.hrportal.performance.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hrportal.performance.entity.Enums.CycleStatus;
import com.hrportal.performance.entity.Enums.Respondent;
import com.hrportal.performance.entity.Enums.ReviewStatus;
import com.hrportal.performance.entity.EvaluationForm;
import com.hrportal.performance.entity.Feedback;
import com.hrportal.performance.entity.FormQuestion;
import com.hrportal.performance.entity.Goal;
import com.hrportal.performance.entity.KeyResult;
import com.hrportal.performance.entity.PerfEmployee;
import com.hrportal.performance.entity.PerformanceReview;
import com.hrportal.performance.entity.ReviewAnswer;
import com.hrportal.performance.entity.ReviewCycle;
import com.hrportal.performance.entity.ReviewHistory;

public final class PerformanceRepositories {
    private PerformanceRepositories() {
    }

    public interface FormRepository extends JpaRepository<EvaluationForm, String> {
    }

    public interface QuestionRepository extends JpaRepository<FormQuestion, String> {
        List<FormQuestion> findByFormIdOrderByOrderNoAsc(String formId);

        @Modifying
        @Query("delete from FormQuestion q where q.formId = :formId")
        int deleteByFormId(@Param("formId") String formId);
    }

    public interface CycleRepository extends JpaRepository<ReviewCycle, String> {
        List<ReviewCycle> findByStatus(CycleStatus status);
    }

    public interface ReviewRepository extends JpaRepository<PerformanceReview, String> {
        Optional<PerformanceReview> findByCycleIdAndEmployeeId(String cycleId, String employeeId);

        List<PerformanceReview> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

        List<PerformanceReview> findByCycleId(String cycleId);

        Page<PerformanceReview> findByCycleId(String cycleId, Pageable pageable);

        List<PerformanceReview> findByManagerIdAndStatusIn(String managerId, Collection<ReviewStatus> statuses);

        List<PerformanceReview> findByStatusOrderByManagerSubmittedAtAsc(ReviewStatus status);

        boolean existsByCycleId(String cycleId);
    }

    public interface AnswerRepository extends JpaRepository<ReviewAnswer, String> {
        List<ReviewAnswer> findByReviewId(String reviewId);

        Optional<ReviewAnswer> findByReviewIdAndQuestionIdAndRespondent(String reviewId, String questionId, Respondent respondent);
    }

    public interface GoalRepository extends JpaRepository<Goal, String> {
        List<Goal> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);

        List<Goal> findByEmployeeIdAndCycleIdOrderByCreatedAtDesc(String employeeId, String cycleId);
    }

    public interface KeyResultRepository extends JpaRepository<KeyResult, String> {
        List<KeyResult> findByGoalIdIn(Collection<String> goalIds);

        List<KeyResult> findByGoalId(String goalId);
    }

    public interface FeedbackRepository extends JpaRepository<Feedback, String> {
        List<Feedback> findByToEmployeeIdOrderByCreatedAtDesc(String toEmployeeId);
    }

    public interface HistoryRepository extends JpaRepository<ReviewHistory, String> {
        List<ReviewHistory> findByReviewIdOrderByCreatedAtAsc(String reviewId);
    }

    public interface PerfEmployeeRepository extends JpaRepository<PerfEmployee, String> {
        List<PerfEmployee> findByStatusIn(Collection<String> statuses);
    }
}
