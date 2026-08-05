import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import * as yup from "yup";
//COMPONENT
import { Close } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import dayjs from "dayjs";
import {
  banUser,
  DEFAULT_BAN_DAYS,
  HOURS_PER_DAY,
  unbanUser,
} from "../../../core/apis/usersAPI";
import {
  FormDropdownList,
  FormInput,
} from "../../form-component/FormComponent";

const reasonSchema = yup
  .string()
  .label("Reason")
  .max(500)
  .required()
  .test(
    "not-only-spaces",
    "Reason cannot be only spaces",
    (value) => value != null && value.trim().length > 0,
  );

/*
  The ban is always stored in hours, but a ban is rarely thought of in hours,
  so the admin picks the unit the number is expressed in and it is converted
  on submit.
*/
const BAN_DURATION_UNITS = [
  { id: "days", name: "Day(s)", hours: HOURS_PER_DAY },
  { id: "hours", name: "Hour(s)", hours: 1 },
];

const DEFAULT_BAN_UNIT = BAN_DURATION_UNITS[0];

const toHours = (duration, unit) =>
  Number(duration) * (unit?.hours || DEFAULT_BAN_UNIT.hours);

/*
  No upper bound: the admin enters whatever duration the ban needs, the 365
  days of the story is only the value the field starts with.
*/
const banSchema = yup.object().shape({
  duration: yup
    .number()
    .label("Ban duration")
    .transform((value, original) =>
      original === "" || original == null ? undefined : value,
    )
    .typeError("Ban duration must be a number")
    .integer("Ban duration must be a whole number")
    .min(1, "Ban duration must be at least 1")
    .required("Ban duration is required"),
  unit: yup
    .object()
    .label("Ban duration unit")
    .nullable()
    .required("Ban duration unit is required"),
  reason: reasonSchema,
});

const unbanSchema = yup.object().shape({
  reason: reasonSchema,
});

// Reads the duration back in both units, so whichever one the admin did not
// pick is still in front of them before they confirm.
const formatDuration = (duration, unit) => {
  const value = Number(duration);

  if (!Number.isFinite(value) || value <= 0) return null;

  const hours = toHours(value, unit);
  const days = hours / HOURS_PER_DAY;

  if (unit?.id === "days") {
    return `${value} day(s) (${hours} hour(s))`;
  }

  return `${hours} hour(s) ≈ ${
    Number.isInteger(days) ? days : days.toFixed(1)
  } day(s)`;
};

/*
  Single confirmation popup for both directions of TEOS-63.

  Ban   : ban duration, in days or in hours (pre-filled with 365 days), and a
          mandatory reason.
  Unban : mandatory reason only.

  The action is only offered to super admins by the caller
  (src/pages/users/UsersPage.jsx via useIsSuperAdmin).
*/
const BanUser = ({ user, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const adminId = useSelector((state) => state.authentication?.user_info?.id);

  const isBanned = !!user?.is_banned;

  const {
    control,
    handleSubmit,
    watch,
    formState: { isValid },
  } = useForm({
    defaultValues: {
      duration: DEFAULT_BAN_DAYS,
      unit: DEFAULT_BAN_UNIT,
      reason: "",
    },
    resolver: yupResolver(isBanned ? unbanSchema : banSchema),
    mode: "all",
  });

  const duration = watch("duration");
  const unit = watch("unit");
  const userLabel = user?.email || user?.id;

  const onSubmit = (values) => {
    setIsSubmitting(true);

    const request = isBanned
      ? unbanUser({
          userId: user?.id,
          reason: values?.reason?.trim(),
          adminId,
          previousBannedUntil: user?.banned_until || null,
        })
      : banUser({
          userId: user?.id,
          hours: toHours(values?.duration, values?.unit),
          reason: values?.reason?.trim(),
          adminId,
        });

    request
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error);
          return;
        }

        toast.success(res?.data?.message);
        if (res?.auditError) {
          toast.warn(
            `The user was updated but the audit log failed: ${res.auditError}`,
          );
        }

        onSuccess();
        onClose();
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const content = isBanned
    ? {
        title: "Unban User",
        body: `You are about to remove the ban on "${userLabel}"${
          user?.banned_until
            ? `, currently banned until ${dayjs(user?.banned_until).format(
                "DD-MM-YYYY HH:mm",
              )}`
            : ""
        }. The user will regain access to the platform immediately. Do you want to continue?`,
        confirmLabel: isSubmitting ? "Unbanning..." : "Confirm Unban",
        confirmColor: "primary",
        icon: <InfoOutlinedIcon color="primary" />,
        reasonPlaceholder: "e.g. The account was reviewed and cleared.",
      }
    : {
        title: "Ban User",
        body: `You are about to ban "${userLabel}" for ${
          formatDuration(duration, unit) || "the duration entered below"
        }. The user will not be able to access the platform during this period. Do you want to continue?`,
        confirmLabel: isSubmitting ? "Banning..." : "Confirm Ban",
        confirmColor: "error",
        icon: <WarningAmberIcon color="warning" />,
        reasonPlaceholder: "e.g. Suspicious activity detected on the account.",
      };

  return (
    <Dialog open={true} maxWidth="sm" fullWidth>
      <DialogContent className="flex flex-col gap-[1rem] xs:!px-8 !py-10 ">
        <div className={"flex flex-row justify-end"}>
          <IconButton
            aria-label="close"
            disabled={isSubmitting}
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

        <div className={"flex flex-col gap-[1rem]"}>
          <h1 className={"text-center"}>{content.title}</h1>

          <div className={"flex flex-row gap-[0.75rem] items-start"}>
            {content.icon}
            <p className={"break-words"}>{content.body}</p>
          </div>

          {!isBanned && (
            <div className="label-input-wrapper">
              <label className="w-full">
                Ban Duration*
                <div className={"flex flex-row gap-[0.75rem] items-start"}>
                  <div className={"w-3/5"}>
                    <Controller
                      name="duration"
                      control={control}
                      render={({
                        field: { onChange, value },
                        fieldState: { error },
                      }) => (
                        <FormInput
                          type="number"
                          placeholder={`${DEFAULT_BAN_DAYS}`}
                          value={value}
                          helperText={error?.message}
                          onChange={(val) => onChange(val)}
                        />
                      )}
                    />
                  </div>
                  <div className={"w-2/5"}>
                    <Controller
                      name="unit"
                      control={control}
                      render={({
                        field: { onChange, value },
                        fieldState: { error },
                      }) => (
                        <FormDropdownList
                          required
                          placeholder={"Select Unit"}
                          value={value}
                          data={BAN_DURATION_UNITS}
                          accessName={"name"}
                          helperText={error?.message}
                          onChange={(val) => onChange(val)}
                        />
                      )}
                    />
                  </div>
                </div>
              </label>
            </div>
          )}

          <div className="label-input-wrapper">
            <Controller
              name="reason"
              control={control}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <label className="w-full">
                  Reason*
                  <FormInput
                    placeholder={content.reasonPlaceholder}
                    multiline={true}
                    minRows={3}
                    maxRows={6}
                    value={value}
                    helperText={error?.message}
                    onChange={(val) => onChange(val)}
                  />
                </label>
              )}
            />
          </div>

          <div className={"w-full flex flex-row justify-between gap-[1rem]"}>
            <Button
              variant={"contained"}
              sx={{ width: "100%" }}
              color="secondary"
              disabled={isSubmitting}
              onClick={() => onClose()}
            >
              Cancel
            </Button>
            <Button
              variant={"contained"}
              sx={{ width: "100%" }}
              color={"primary"}
              disabled={!isValid || isSubmitting}
              onClick={handleSubmit(onSubmit)}
            >
              {content.confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BanUser;
