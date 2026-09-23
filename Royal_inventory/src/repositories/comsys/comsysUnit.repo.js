'use strict';

const { getComsysDB, sql } = require('../../config/comsys.database');
const { ComsysUnavailableError } = require('../../utils/errors');

const requireComsys = () => {
  const pool = getComsysDB();
  if (!pool) throw new ComsysUnavailableError();
  return pool;
};

/**
 * Get all units from Comsys.
 * @param {'fb'|'gs'} prefix - division prefix (fb = F&B, gs = General)
 */
const getAllUnits = async (prefix = 'fb') => {
  const pool = requireComsys();
  const table = `dbo.FG${prefix}UNIT`;

  const result = await pool.request().query(`
    SELECT
      u.Code   AS unit_code,
      u.Name1  AS unit_name_ar,
      u.Name0  AS unit_name_en
    FROM ${table} u
    ORDER BY u.Code
  `);

  return result.recordset;
};

module.exports = {
  getAllUnits,
};
