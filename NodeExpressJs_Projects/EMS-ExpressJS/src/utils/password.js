const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { bcryptRounds } = require('../config/auth');

const POLICY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,72}$/;
const POLICY_MESSAGE = 'Password must be 10-72 characters with upper, lower, digit and special character';

const hash = (plain) => bcrypt.hash(plain, bcryptRounds);
const verify = (plain, hashed) => bcrypt.compare(plain, hashed);
const isStrong = (plain) => typeof plain === 'string' && POLICY.test(plain);
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const randomToken = () => crypto.randomBytes(48).toString('base64url');

module.exports = { hash, verify, isStrong, POLICY_MESSAGE, sha256, randomToken };
