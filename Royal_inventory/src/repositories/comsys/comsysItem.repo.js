'use strict';

const { getComsysDB, sql } = require('../../config/comsys.database');
const { ComsysUnavailableError } = require('../../utils/errors');

const requireComsys = () => {
  const pool = getComsysDB();
  if (!pool) throw new ComsysUnavailableError();
  return pool;
};

/**
 * Get all items from Comsys with their unit name.
 * @param {'fb'|'gs'} prefix - division prefix (fb = F&B, gs = General)
 */
const getAllItems = async (prefix = 'fb') => {
  const pool = requireComsys();
  const itemTable = `dbo.FG${prefix}Item`;
  const unitTable = `dbo.FG${prefix}UNIT`;

  const result = await pool.request().query(`
    SELECT
      RTRIM(LTRIM(i.Item))     AS item_code,
      RTRIM(LTRIM(i.Name1))    AS item_name_ar,
      RTRIM(LTRIM(i.Name0))    AS item_name_en,
      RTRIM(LTRIM(i.Category)) AS category_code,
      RTRIM(LTRIM(i.SUnit))    AS unit_code,
      RTRIM(LTRIM(u.Name1))    AS unit_name_ar,
      CASE WHEN i.NotActive = 0 THEN 1 ELSE 0 END AS is_active
    FROM ${itemTable} i
    LEFT JOIN ${unitTable} u ON i.SUnit = u.Code
    ORDER BY i.Item
  `);

  return result.recordset;
};

module.exports = {
  getAllItems,
};
