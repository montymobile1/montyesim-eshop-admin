import { Close } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { getAuditLogById } from "../../core/apis/auditLogAPI";
import { actorLabel, formatAuditDate, prettyJson } from "../../core/helpers/auditJson";

const LARGE_JSON = 1500;

const Field = ({ label, value }) => (
  <div className={"flex flex-col gap-1"}>
    <label className={"font-semibold"}>{label}</label>
    <p className={"break-words whitespace-pre-wrap"}>{value ?? "N/A"}</p>
  </div>
);

// old_data / new_data come parsed and redacted from the API (MS-5049).
const JsonCard = ({ title, value }) => {
  const text = prettyJson(value);
  const pre = (
    <pre
      className={
        "text-xs whitespace-pre-wrap break-words max-h-[300px] overflow-auto"
      }
    >
      {text}
    </pre>
  );

  return (
    <Card>
      <CardContent className={"flex flex-col gap-2"}>
        <h3>{title}</h3>
        {text.length > LARGE_JSON ? (
          <details>
            <summary className="cursor-pointer">
              Show {text.length} characters
            </summary>
            {pre}
          </details>
        ) : (
          pre
        )}
      </CardContent>
    </Card>
  );
};

const AuditLogDetail = ({ id, onClose }) => {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-log", "detail", id],
    queryFn: () => getAuditLogById(id),
    enabled: !!id,
  });

  const log = data?.data?.data;

  /*
    Ban / unban rows carry no old_data / new_data: the context of the
    operation is in operation_details, so that is shown instead.
  */
  const hasDataSnapshots = log?.old_data != null || log?.new_data != null;

  return (
    <Dialog open={true} maxWidth="md" fullWidth>
      <DialogContent className="flex flex-col gap-[1rem] xs:!px-8 !py-10 ">
        <div className={"flex flex-row justify-end"}>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={() => ({
              position: "absolute",
              right: 8,
              top: 8,
              color: "black",
            })}
          >
            <Close />
          </IconButton>
        </div>

        <h1 className={"text-center"}>Audit Log Detail</h1>

        {isLoading && (
          <div className="flex justify-center">
            <CircularProgress />
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center gap-2">
            <p>Failed to load the audit entry</p>
            <Button variant="outlined" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}

        {log && (
          <>
            <div className={"grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3"}>
              <Field label="Table Name" value={log?.table_name} />
              <Field
                label="Operation"
                value={
                  log?.legacy_operation
                    ? `${log?.operation} (${log?.legacy_operation})`
                    : log?.operation
                }
              />
              <Field label="Changed By" value={actorLabel(log?.changed_by)} />
              <Field
                label="Changed At"
                value={formatAuditDate(log?.changed_at)}
              />
              <Field label="Rows Affected" value={log?.rows_affected} />
              <Field label="Reason" value={log?.reason} />
              <Field
                label="IP Address"
                value={
                  log?.ip_address && log?.client_reported
                    ? `${log?.ip_address} (IP reported by browser)`
                    : log?.ip_address
                }
              />
              {log?.hours_banned != null && (
                <Field label="Hours Banned" value={log?.hours_banned} />
              )}
              {/* TEOS-150: a BAN row keeps the ban it replaced; UNBAN the ban it lifted */}
              {log?.operation === "BAN" && (
                <Field
                  label="Banned until"
                  value={formatAuditDate(log?.operation_details?.banned_until)}
                />
              )}
              {["BAN", "UNBAN"].includes(log?.operation) && (
                <Field
                  label="Previous ban end"
                  value={formatAuditDate(
                    log?.operation_details?.previous_banned_until,
                  )}
                />
              )}
              {log?.record_id && (
                <Field label="Record" value={log?.record_id} />
              )}
            </div>

            {log?.parse_error && <p>Some details are unavailable</p>}

            {hasDataSnapshots ? (
              <div
                className={"grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4"}
              >
                <JsonCard title="Old Data" value={log?.old_data} />
                <JsonCard title="New Data" value={log?.new_data} />
              </div>
            ) : (
              <JsonCard
                title="Operation Details"
                value={log?.operation_details}
              />
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuditLogDetail;
