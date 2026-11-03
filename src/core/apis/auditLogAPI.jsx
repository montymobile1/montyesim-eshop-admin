import { api } from "./axios";

/*
  Audit log (MS-5049) on the admin API. Read only, super admin only (admin.audit.read).

  GET /audit-log?table&operation&changed_by&from&to&page&page_size
    -> res.data.data = { data: [{ id, changed_at, table_name, operation, legacy_operation,
         record_id, changed_by: {id,email}|null, ip_address, reason, rows_affected,
         client_reported, summary }], total_count, facets: { by_table: { <table>: n } } }
  GET /audit-log/{id}
    -> the row plus hours_banned, old_data, new_data, operation_details, parse_error
       (parsed and with secret values replaced by "***" on the server)

  Audit rows are written by the server only; the browser never writes one.
*/
export const getAllAuditLogs = async (params) => {
  return await api.get(`audit-log`, { params });
};

export const getAuditLogById = async (id) => {
  return await api.get(`audit-log/${id}`);
};
