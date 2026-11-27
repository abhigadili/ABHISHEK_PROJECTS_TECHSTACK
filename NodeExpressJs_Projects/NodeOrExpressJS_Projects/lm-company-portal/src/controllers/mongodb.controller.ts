// ============================================================
// WHAT: MongoDB Learning Module — every operation demonstrated via HTTP endpoints
// WHY:  Hands-on API calls teach MongoDB operations better than reading docs.
//       Each endpoint covers one concept with inline explanations.
// HOW:  Uses Mongoose models AND the native MongoDB driver (via mongoose.connection.db)
//       to show both approaches side-by-side.
// Interview Tip: Know the difference between Mongoose model methods and
//               the raw MongoDB driver — Mongoose adds schema validation and hooks;
//               the driver gives you raw power (aggregation, bulk ops, etc.).
// ============================================================

import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Employee } from '../models/employee.model';
import { Company } from '../models/company.model';
import { sendSuccess } from '../utils/response.helper';

// Shorthand to the native db object (bypasses Mongoose schema)
const db = () => mongoose.connection.db!;

export const mongodbController = {

  // ---- Database-level operations ----

  async showDbs(req: Request, res: Response, next: NextFunction) {
    try {
      // listDatabases is a MongoDB admin command
      // Equivalent to running: show dbs in the Mongo shell
      const result = await mongoose.connection.db!.admin().listDatabases();
      sendSuccess(res, result.databases, 'All databases listed');
    } catch (err) { next(err); }
  },

  async showCollections(req: Request, res: Response, next: NextFunction) {
    try {
      // Equivalent to: show collections
      const collections = await db().listCollections().toArray();
      sendSuccess(res, collections.map(c => c.name), 'Collections in current database');
    } catch (err) { next(err); }
  },

  // ---- insertOne ----
  // Inserts a single document. Returns the inserted document's _id.
  // Interview Tip: MongoDB auto-generates _id (ObjectId) if not provided.
  //               ObjectId encodes the creation timestamp — you can extract it!
  async insertOne(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.create(req.body);
      sendSuccess(res, result, 'insertOne: document created');
    } catch (err) { next(err); }
  },

  // ---- insertMany ----
  // Inserts an array of documents in one network round-trip (more efficient than multiple insertOne).
  // Interview Tip: Use insertMany for bulk loading seed data. ordered:false continues
  //               on error instead of stopping at the first failure.
  async insertMany(req: Request, res: Response, next: NextFunction) {
    try {
      const docs = req.body; // expects an array
      const result = await Employee.insertMany(docs, { ordered: false });
      sendSuccess(res, result, `insertMany: ${result.length} documents inserted`);
    } catch (err) { next(err); }
  },

  // ---- find (with projection, sort, skip, limit) ----
  // The most common read operation. Returns a cursor (lazy evaluation).
  // Interview Tip: find() returns a Query object (cursor), not data.
  //               Chain .skip().limit().sort() before awaiting.
  async find(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = 1, pageSize = 10, sort = 'firstName', order = 'asc' } = req.query as any;

      // Projection: include only these fields (1=include, 0=exclude)
      // Interview Tip: Never mix include (1) and exclude (0) except for _id.
      const projection = { firstName: 1, lastName: 1, email: 1, designation: 1, salary: 1 };

      const employees = await Employee
        .find({ isActive: true })        // filter
        .select(projection)              // projection
        .sort({ [sort]: order === 'asc' ? 1 : -1 }) // sort
        .skip((page - 1) * pageSize)     // pagination: skip first N
        .limit(Number(pageSize));        // pagination: return only N

      const total = await Employee.countDocuments({ isActive: true });

      sendSuccess(res, { employees, total, page, pageSize }, 'find with pagination, projection, sort');
    } catch (err) { next(err); }
  },

  // ---- findOne ----
  async findOne(req: Request, res: Response, next: NextFunction) {
    try {
      const emp = await Employee.findOne({ email: req.params.email });
      sendSuccess(res, emp, 'findOne result');
    } catch (err) { next(err); }
  },

  // ---- updateOne ----
  // Updates the FIRST matching document.
  // $set: updates only specified fields (does NOT replace the entire document).
  // Interview Tip: Without $set, MongoDB replaces the entire document!
  async updateOne(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.updateOne(
        { _id: req.params.id },
        { $set: req.body }    // only update provided fields
      );
      sendSuccess(res, result, 'updateOne result');
    } catch (err) { next(err); }
  },

  // ---- updateMany ----
  async updateMany(req: Request, res: Response, next: NextFunction) {
    try {
      const { filter, update } = req.body;
      const result = await Employee.updateMany(filter, { $set: update });
      sendSuccess(res, result, `updateMany: ${result.modifiedCount} documents modified`);
    } catch (err) { next(err); }
  },

  // ---- replaceOne ----
  // Replaces the ENTIRE document (not just fields). Use with caution.
  // Interview Tip: replaceOne() vs updateOne($set): replace overwrites ALL fields.
  async replaceOne(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.replaceOne({ _id: req.params.id }, req.body);
      sendSuccess(res, result, 'replaceOne result');
    } catch (err) { next(err); }
  },

  // ---- deleteOne ----
  async deleteOne(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.deleteOne({ _id: req.params.id });
      sendSuccess(res, result, 'deleteOne result');
    } catch (err) { next(err); }
  },

  // ---- deleteMany ----
  async deleteMany(req: Request, res: Response, next: NextFunction) {
    try {
      const { filter } = req.body;
      const result = await Employee.deleteMany(filter);
      sendSuccess(res, result, `deleteMany: ${result.deletedCount} documents deleted`);
    } catch (err) { next(err); }
  },

  // ---- findOneAndUpdate ----
  // Atomic: finds, updates, and returns the document in one operation.
  // Interview Tip: Use findOneAndUpdate when you need the updated doc.
  //               returnDocument: 'after' returns the updated version.
  async findOneAndUpdate(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await Employee.findOneAndUpdate(
        { _id: req.params.id },
        { $set: req.body },
        { new: true, runValidators: true } // new:true = return updated doc
      );
      sendSuccess(res, updated, 'findOneAndUpdate result');
    } catch (err) { next(err); }
  },

  // ---- findOneAndDelete ----
  async findOneAndDelete(req: Request, res: Response, next: NextFunction) {
    try {
      const deleted = await Employee.findOneAndDelete({ _id: req.params.id });
      sendSuccess(res, deleted, 'findOneAndDelete result');
    } catch (err) { next(err); }
  },

  // ---- Query Operators ----
  // MongoDB query operators let you express complex conditions without SQL.
  // Interview Tip: Know all comparison operators — they appear in interviews constantly.
  async queryOperators(req: Request, res: Response, next: NextFunction) {
    try {
      const examples: Record<string, any> = {};

      // $eq — equal to (implicit when using plain value)
      examples.$eq = await Employee.find({ designation: { $eq: 'Engineer' } }).limit(3);

      // $ne — not equal
      examples.$ne = await Employee.find({ designation: { $ne: 'Intern' } }).limit(3);

      // $gt / $gte / $lt / $lte — numeric comparisons
      examples.$gt  = await Employee.find({ salary: { $gt: 50000 } }).limit(3);
      examples.$gte = await Employee.find({ salary: { $gte: 50000 } }).limit(3);
      examples.$lt  = await Employee.find({ salary: { $lt: 100000 } }).limit(3);
      examples.$lte = await Employee.find({ salary: { $lte: 100000 } }).limit(3);

      // $in — value is in an array
      examples.$in  = await Employee.find({ designation: { $in: ['Engineer', 'Manager', 'Lead'] } }).limit(3);

      // $nin — value NOT in array
      examples.$nin = await Employee.find({ designation: { $nin: ['Intern', 'Trainee'] } }).limit(3);

      // $exists — field exists (true) or doesn't exist (false)
      examples.$exists = await Employee.find({ managerId: { $exists: true } }).limit(3);

      // $type — field is of a specific BSON type
      examples.$type = await Employee.find({ salary: { $type: 'number' } }).limit(3);

      // $regex — pattern match (use sparingly — not index-friendly)
      // Best Practice: Prefer text indexes for full-text search
      examples.$regex = await Employee.find({ email: { $regex: /@lm\.com$/i } }).limit(3);

      sendSuccess(res, examples, 'Query operators demonstration');
    } catch (err) { next(err); }
  },

  // ---- Logical Operators ----
  async logicalOperators(req: Request, res: Response, next: NextFunction) {
    try {
      // $and — ALL conditions must match
      const andResult = await Employee.find({
        $and: [{ salary: { $gte: 50000 } }, { isActive: true }]
      }).limit(3);

      // $or — ANY condition matches
      const orResult = await Employee.find({
        $or: [{ designation: 'Manager' }, { salary: { $gt: 100000 } }]
      }).limit(3);

      // $nor — NONE of the conditions match
      const norResult = await Employee.find({
        $nor: [{ designation: 'Intern' }, { isActive: false }]
      }).limit(3);

      // $not — negates a single condition
      const notResult = await Employee.find({
        salary: { $not: { $lt: 30000 } }
      }).limit(3);

      sendSuccess(res, { andResult, orResult, norResult, notResult }, 'Logical operators');
    } catch (err) { next(err); }
  },

  // ---- Array Operators ----
  async arrayOperators(req: Request, res: Response, next: NextFunction) {
    try {
      // For demo, query companies (which might have array fields)
      // $all — array contains ALL specified values
      // $elemMatch — at least one array element matches ALL conditions
      // $size — array has exactly N elements

      // Using raw collection for flexibility in demo
      const col = db().collection('employees');

      const examples = {
        $all:       await col.find({ tags: { $all: ['nodejs', 'typescript'] } }).limit(3).toArray(),
        $elemMatch: await col.find({ skills: { $elemMatch: { level: { $gte: 3 } } } }).limit(3).toArray(),
        $size:      await col.find({ tags: { $size: 2 } }).limit(3).toArray(),
      };

      sendSuccess(res, examples, 'Array operators ($all, $elemMatch, $size)');
    } catch (err) { next(err); }
  },

  // ---- Projection ----
  // Control which fields are returned (reduces payload size)
  async projection(req: Request, res: Response, next: NextFunction) {
    try {
      // Include projection: only return these fields (1)
      const included = await Employee.find().select({ firstName: 1, lastName: 1, email: 1 }).limit(5);

      // Exclude projection: return everything EXCEPT these fields (0)
      const excluded = await Employee.find().select({ salary: 0, __v: 0 }).limit(5);

      // Mixed is NOT allowed (except _id) — this is a common interview question
      sendSuccess(res, { included, excluded }, 'Projection examples');
    } catch (err) { next(err); }
  },

  // ---- Sorting ----
  async sorting(req: Request, res: Response, next: NextFunction) {
    try {
      const asc  = await Employee.find().sort({ salary: 1 }).limit(5);  // ascending
      const desc = await Employee.find().sort({ salary: -1 }).limit(5); // descending
      const multi = await Employee.find().sort({ designation: 1, salary: -1 }).limit(5); // multi-field

      sendSuccess(res, { ascending: asc, descending: desc, multiField: multi }, 'Sorting examples');
    } catch (err) { next(err); }
  },

  // ---- Pagination (skip + limit) ----
  // Interview Tip: skip() is inefficient for large collections (it still scans skipped docs).
  //               For large datasets, use cursor-based pagination (keyset pagination).
  async pagination(req: Request, res: Response, next: NextFunction) {
    try {
      const page     = parseInt(req.query.page as string, 10) || 1;
      const pageSize = parseInt(req.query.pageSize as string, 10) || 10;

      // skip: how many documents to skip = (page - 1) * pageSize
      // limit: how many documents to return
      const employees = await Employee.find()
        .skip((page - 1) * pageSize)  // e.g. page 3, size 10 → skip 20
        .limit(pageSize);

      const total = await Employee.countDocuments();

      sendSuccess(res, {
        employees,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: page * pageSize < total,
          hasPrev: page > 1,
        }
      }, 'Pagination with skip/limit');
    } catch (err) { next(err); }
  },

  // ---- Aggregation Pipeline ----
  // The most powerful MongoDB feature. Processes documents through stages.
  // Each stage transforms the data and passes it to the next stage.
  // Interview Tip: Aggregation is ESSENTIAL for analytics, reporting, and joins.
  //               Know $match, $group, $project, $lookup, $unwind cold.
  async aggregation(req: Request, res: Response, next: NextFunction) {
    try {
      const pipeline = await Employee.aggregate([

        // $match — filter documents (like WHERE in SQL)
        // Best Practice: Put $match FIRST to reduce the working set early.
        { $match: { isActive: true } },

        // $group — group documents and compute aggregations
        // _id defines the grouping key; null groups everything into one doc
        {
          $group: {
            _id: '$designation',           // group by designation
            count:    { $sum: 1 },         // count employees per group
            avgSalary:{ $avg: '$salary' }, // average salary per group
            maxSalary:{ $max: '$salary' }, // highest salary per group
            minSalary:{ $min: '$salary' }, // lowest salary per group
          }
        },

        // $project — reshape documents (like SELECT in SQL)
        {
          $project: {
            designation: '$_id',
            count: 1,
            avgSalary: { $round: ['$avgSalary', 2] }, // round to 2 decimals
            maxSalary: 1,
            minSalary: 1,
            _id: 0,  // suppress _id
          }
        },

        // $sort — sort the results
        { $sort: { count: -1 } },

        // $limit — take top N
        { $limit: 10 },
      ]);

      sendSuccess(res, pipeline, 'Aggregation: salary stats by designation');
    } catch (err) { next(err); }
  },

  // ---- $lookup (JOIN equivalent) ----
  // Interview Tip: MongoDB is document-oriented — avoid $lookup in hot paths.
  //               Design your schema to embed related data when possible.
  //               Use $lookup for analytics/reporting, not transactional queries.
  async lookup(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.aggregate([
        { $match: { isActive: true } },
        {
          $lookup: {
            from: 'departments',    // the collection to join
            localField: 'departmentId', // field in employees
            foreignField: '_id',        // field in departments
            as: 'department',           // output array field name
          }
        },
        // $unwind — flatten the array (turns [dept] into dept)
        // WHY: $lookup always returns an array; use $unwind for one-to-one joins
        { $unwind: { path: '$department', preserveNullAndEmptyArrays: false } },
        {
          $project: {
            firstName: 1, lastName: 1, email: 1, designation: 1,
            'department.name': 1,
          }
        },
        { $limit: 10 },
      ]);

      sendSuccess(res, result, '$lookup join: employees with department names');
    } catch (err) { next(err); }
  },

  // ---- $facet (multiple pipelines in parallel) ----
  // Run several sub-pipelines on the same input documents simultaneously.
  // Great for dashboards that need multiple stats in one query.
  async facet(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.aggregate([
        { $match: { isActive: true } },
        {
          $facet: {
            // Sub-pipeline 1: salary breakdown by designation
            byDesignation: [
              { $group: { _id: '$designation', count: { $sum: 1 }, avg: { $avg: '$salary' } } },
              { $sort: { count: -1 } },
            ],
            // Sub-pipeline 2: top earners
            topEarners: [
              { $sort: { salary: -1 } },
              { $limit: 5 },
              { $project: { firstName: 1, lastName: 1, salary: 1, designation: 1 } },
            ],
            // Sub-pipeline 3: total count and salary sum
            summary: [
              { $group: { _id: null, total: { $sum: 1 }, totalSalary: { $sum: '$salary' } } },
              { $project: { _id: 0 } },
            ],
          }
        }
      ]);

      sendSuccess(res, result[0], '$facet: multiple aggregations in one query');
    } catch (err) { next(err); }
  },

  // ---- $addFields ----
  async addFields(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.aggregate([
        { $match: { isActive: true } },
        {
          $addFields: {
            fullName:       { $concat: ['$firstName', ' ', '$lastName'] },
            annualSalary:   { $multiply: ['$salary', 12] },
            seniorityLevel: {
              $switch: {
                branches: [
                  { case: { $gte: ['$salary', 100000] }, then: 'Senior' },
                  { case: { $gte: ['$salary', 60000]  }, then: 'Mid'    },
                ],
                default: 'Junior',
              }
            }
          }
        },
        { $project: { fullName: 1, salary: 1, annualSalary: 1, seniorityLevel: 1 } },
        { $limit: 10 },
      ]);

      sendSuccess(res, result, '$addFields: computed fields');
    } catch (err) { next(err); }
  },

  // ---- $bucket ----
  // Groups documents into ranges (like a histogram)
  async bucket(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.aggregate([
        {
          $bucket: {
            groupBy: '$salary',
            boundaries: [0, 30000, 60000, 100000, 150000, Infinity],
            default: 'Other',
            output: {
              count: { $sum: 1 },
              employees: { $push: { name: { $concat: ['$firstName', ' ', '$lastName'] }, salary: '$salary' } },
            }
          }
        }
      ]);

      sendSuccess(res, result, '$bucket: salary histogram');
    } catch (err) { next(err); }
  },

  // ---- $count ----
  async count(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await Employee.aggregate([
        { $match: { isActive: true } },
        { $count: 'totalActiveEmployees' }
      ]);

      sendSuccess(res, result[0], '$count: total active employees');
    } catch (err) { next(err); }
  },

  // ---- Dashboard stats (TYPE 3: Node.js + Express combined) ----
  // WHY combine them: The dashboard endpoint runs multiple DB queries in parallel
  // using Node.js's event loop and Promise.all, then formats the response with Express.
  // This demonstrates Node.js's non-blocking I/O strength alongside Express routing.
  async dashboardStats(req: Request, res: Response, next: NextFunction) {
    try {
      // Promise.all runs all queries in parallel — non-blocking, efficient.
      // Interview Tip: This is Node.js's superpower — concurrent I/O without threads.
      const [
        totalEmployees,
        totalCompanies,
        salaryStats,
        recentEmployees,
      ] = await Promise.all([
        Employee.countDocuments({ isActive: true }),
        Company.countDocuments({ isActive: true }),
        Employee.aggregate([
          { $group: { _id: null, avg: { $avg: '$salary' }, max: { $max: '$salary' }, min: { $min: '$salary' } } }
        ]),
        Employee.find({ isActive: true }).sort({ createdAt: -1 }).limit(5).select('firstName lastName designation createdAt'),
      ]);

      sendSuccess(res, {
        totalEmployees,
        totalCompanies,
        salaryStats: salaryStats[0] || {},
        recentEmployees,
      }, 'Dashboard statistics');
    } catch (err) { next(err); }
  },
};
