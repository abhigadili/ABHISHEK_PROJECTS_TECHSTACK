module.exports = (err, req, res, next) => {
  console.error(err);
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({
    error: err.message || "Internal Server Error",
    ...(err.body ? { outpost: err.body } : {}),
  });
};
