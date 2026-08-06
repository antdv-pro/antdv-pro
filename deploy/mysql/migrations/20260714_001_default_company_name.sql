USE enterprise_system;

UPDATE sys_company
SET name = '青海诚捷运输有限公司'
WHERE code = 'COMP001'
  AND name <> '青海诚捷运输有限公司';
