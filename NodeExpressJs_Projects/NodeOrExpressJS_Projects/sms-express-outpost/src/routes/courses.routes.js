const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const courseModel = require("../models/courseModel");
const outpostService = require("../outpost/outpostService");

const router = express.Router();

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { department, code, title, credits } = req.body;
    if (!department || !code || !title) {
      return res.status(400).json({ error: "department, code, title are required" });
    }
    const course = await courseModel.create({ tenantId: department, code, title, credits });
    await outpostService.publish(department, "course.created", course);
    res.status(201).json(course);
  })
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const courses = await courseModel.findAll(req.query.department);
    res.json(courses);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const course = await courseModel.findById(req.params.id);
    if (!course) return res.status(404).json({ error: "Course not found" });
    res.json(course);
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await courseModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Course not found" });
    const course = await courseModel.update(req.params.id, req.body);
    await outpostService.publish(course.tenant_id, "course.updated", course);
    res.json(course);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await courseModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: "Course not found" });
    await courseModel.remove(req.params.id);
    await outpostService.publish(existing.tenant_id, "course.deleted", existing);
    res.status(204).send();
  })
);

module.exports = router;
