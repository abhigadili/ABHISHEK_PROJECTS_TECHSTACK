const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const enrollmentModel = require("../models/enrollmentModel");
const studentModel = require("../models/studentModel");
const courseModel = require("../models/courseModel");
const outpostService = require("../outpost/outpostService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { studentId, courseId } = req.body;
    if (!studentId || !courseId) {
      return res.status(400).json({ error: "studentId, courseId are required" });
    }
    const student = await studentModel.findById(studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });
    const course = await courseModel.findById(courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });

    const enrollment = await enrollmentModel.create({
      tenantId: student.tenant_id,
      studentId,
      courseId,
    });
    await outpostService.publish(student.tenant_id, "enrollment.created", {
      ...enrollment,
      student_email: student.email,
      course_code: course.code,
    });
    await outpostService.publish(student.tenant_id, "student.enrolled", {
      studentId: student.id,
      courseId: course.id,
      enrollmentId: enrollment.id,
    });
    res.status(201).json(enrollment);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const enrollments = await enrollmentModel.findAll({
      tenantId: req.query.department,
      studentId: req.query.studentId,
    });
    res.json(enrollments);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const enrollment = await enrollmentModel.findById(req.params.id);
    if (!enrollment) return res.status(404).json({ error: "Enrollment not found" });
    res.json(enrollment);
  })
);

router.post(
  "/:id/cancel",
  asyncHandler(async (req, res) => {
    const existing = await enrollmentModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Enrollment not found" });
    const enrollment = await enrollmentModel.updateStatus(req.params.id, "CANCELLED");
    await outpostService.publish(enrollment.tenant_id, "enrollment.cancelled", enrollment);
    const student = await studentModel.findById(enrollment.student_id);
    await outpostService.publish(enrollment.tenant_id, "student.unenrolled", {
      studentId: enrollment.student_id,
      courseId: enrollment.course_id,
      enrollmentId: enrollment.id,
      studentEmail: student?.email,
    });
    res.json(enrollment);
  })
);

module.exports = router;
