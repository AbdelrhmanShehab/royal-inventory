'use strict';

const { getComsysDB, sql } = require('../../config/comsys.database');
const { ComsysUnavailableError } = require('../../utils/errors');

const requireComsys = () => {
  const pool = getComsysDB();
  if (!pool) throw new ComsysUnavailableError();
  return pool;
};

const { Category } = require('../../api/v1/masterData/masterData.model');

/**
 * Get all categories from Comsys.
 * @param {'fb'|'gs'} prefix - division prefix (fb = F&B, gs = General)
 */
const getAllCategories = async (prefix = 'fb') => {
  const pool = requireComsys();
  const table = `dbo.FG${prefix}Category`;

  const result = await pool.request().query(`
    SELECT
      c.Code   AS category_code,
      c.Name1  AS category_name_ar,
      c.Name0  AS category_name_en
    FROM ${table} c
    ORDER BY c.Code
  `);

  return result.recordset.map(Category.fromDatabase);
};

module.exports = {
  getAllCategories,
};
