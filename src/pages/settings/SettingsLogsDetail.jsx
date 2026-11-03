import { Button, Card, CardContent } from "@mui/material";
import { useState } from "react";
import { displayValue } from "../../core/helpers/auditJson";

const MAX_LENGTH = 120;

// Long values are cut, with a button to show all of it.
const LongValue = ({ text }) => {
  const [expanded, setExpanded] = useState(false);
  if (text.length <= MAX_LENGTH) return <span>{text}</span>;
  return (
    <span>
      {expanded ? text : `${text.substring(0, MAX_LENGTH)}...`}{" "}
      <Button size="small" onClick={() => setExpanded(!expanded)}>
        {expanded ? "Show less" : "Show more"}
      </Button>
    </span>
  );
};

/*
  One settings save: the server's changes[] (MS-5047). No JSON parsing or
  diffing here: the API sends only the keys whose value changed.
*/
const SettingsLogsDetail = ({ data }) => {
  if (data?.parse_error) {
    return <p className={"p-2"}>Details unavailable</p>;
  }

  const changes = data?.changes || [];
  if (changes.length === 0) {
    return <p className={"p-2"}>No changes recorded</p>;
  }

  return (
    <Card>
      <CardContent className={"flex flex-col gap-2"}>
        <h3>{changes.length} changed</h3>
        {changes.map((change) => {
          const created = change?.old_value === null;
          const removed = change?.new_value === null;
          return (
            <div
              key={change?.key}
              data-testid="setting-change"
              className={"grid grid-cols-1 sm:grid-cols-3 sm:gap-4 break-all"}
            >
              <label className={"font-semibold"}>{change?.key}</label>
              <p className={"px-2 rounded bg-red-500"}>
                {created ? (
                  "(new)"
                ) : (
                  <LongValue
                    text={displayValue(change?.old_value, change?.redacted)}
                  />
                )}
              </p>
              <p className={"px-2 rounded bg-green-400"}>
                {removed ? (
                  "(removed)"
                ) : (
                  <LongValue
                    text={displayValue(change?.new_value, change?.redacted)}
                  />
                )}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default SettingsLogsDetail;
