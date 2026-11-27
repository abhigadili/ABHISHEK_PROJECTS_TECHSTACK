require("dotenv").config();

module.exports = {
  port: process.env.PORT || 4000,
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  },
  outpost: {
    baseUrl: process.env.OUTPOST_BASE_URL,
    apiKey: process.env.OUTPOST_API_KEY,
  },
};
