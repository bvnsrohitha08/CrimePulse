const express = require('express');
const { getHealth, getDBHealth } = require('../controllers/healthController');

const router = express.Router();

router.get('/health', getHealth);
router.get('/health/db', getDBHealth);

module.exports = router;
