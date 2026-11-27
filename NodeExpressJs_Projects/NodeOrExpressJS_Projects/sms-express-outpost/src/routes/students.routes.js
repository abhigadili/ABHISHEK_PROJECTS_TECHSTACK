const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const studentModel = require("../models/studentModel");
const outpostService = require("../outpost/outpostService");

const router = express.Router();

// department doubles as the Outpost tenant_id: each department can attach
// its own webhook destinations for its students' lifecycle events.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { firstName, lastName, email, department, enrollmentDate } = req.body;
    if (!firstName || !lastName || !email || !department || !enrollmentDate) {
      return res.status(400).json({
        error: "firstName, lastName, email, department, enrollmentDate are required",
      });
    }
    const student = await studentModel.create({
      tenantId: department,
      firstName,
      lastName,
      email,
      department,
      enrollmentDate,
    });
    await outpostService.publish(department, "student.created", student);
    res.status(201).json(student);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const students = await studentModel.findAll(req.query.department);
    res.json(students);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const student = await studentModel.findById(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.json(student);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await studentModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Student not found" });
    const { firstName, lastName, email, department, status } = req.body;
    const student = await studentModel.update(req.params.id, {
      firstName,
      lastName,
      email,
      department,
      status,
    });
    await outpostService.publish(student.tenant_id, "student.updated", student);
    res.json(student);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await studentModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Student not found" });
    await studentModel.remove(req.params.id);
    await outpostService.publish(existing.tenant_id, "student.deleted", existing);
    res.status(204).send();
  })
);

module.exports = router;
