const express = require('express');
const router = express.Router();
const { getQnAs, createQnA, updateQnA, deleteQnA } = require('../Controllers/qnaController');
const { protectAdmin } = require('../Middlewares/authMiddleware');

router.get('/', getQnAs);
router.post('/', protectAdmin, createQnA);
router.put('/:id', protectAdmin, updateQnA);
router.delete('/:id', protectAdmin, deleteQnA);

module.exports = router;
