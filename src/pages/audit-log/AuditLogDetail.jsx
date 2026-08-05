import { Close } from "@mui/icons-material";
import {
  Card,
  CardContent,
  Dialog,
  DialogContent,
  IconButton,
} from "@mui/material";
import dayjs from "dayjs";
import { parseAuditJson } from "../../core/apis/auditLogAPI";

const Field = ({ label, value }) => (
  <div className={"flex flex-col gap-1"}>
    <label className={"font-semibold"}>{label}</label>
    <p className={"break-words whitespace-pre-wrap"}>{value ?? "N/A"}</p>
  </div>
);

const JsonCard = ({ title, value }) => {
  const parsed = parseAuditJson(value);

  return (
    <Card>
      <CardContent className={"flex flex-col gap-2"}>
        <h3>{title}</h3>
        <pre
          className={
            "text-xs whitespace-pre-wrap break-words max-h-[300px] overflow-auto"
          }
        >
          {parsed == null
            ? "N/A"
            : typeof parsed === "string"
              ? parsed
              : JSON.stringify(parsed, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
};

const AuditLogDetail = ({ log, onClose }) => {
  /*
    Ban / unban rows (TEOS-63) carry no old_data / new_data: the whole context
    of the operation is in operation_details, so that is shown instead.
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

        <div className={"grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3"}>
          <Field label="Table Name" value={log?.table_name} />
          <Field label="Operation" value={log?.operation} />
          <Field
            label="Changed By"
            value={log?.changed_by_label || log?.changed_by}
          />
          <Field
            label="Changed At"
            value={
              log?.changed_at
                ? dayjs.utc(log?.changed_at).local().format("DD-MM-YYYY HH:mm")
                : null
            }
          />
          <Field label="Rows Affected" value={log?.rows_affected} />
          <Field label="Reason" value={log?.reason} />
          <Field label="IP Address" value={log?.ip_address} />
          {log?.hours_banned != null && (
            <Field label="Hours Banned" value={log?.hours_banned} />
          )}
        </div>

        {hasDataSnapshots ? (
          <div className={"grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4"}>
            <JsonCard title="Old Data" value={log?.old_data} />
            <JsonCard title="New Data" value={log?.new_data} />
          </div>
        ) : (
          <JsonCard title="Operation Details" value={log?.operation_details} />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuditLogDetail;
