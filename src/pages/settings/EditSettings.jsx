import { yupResolver } from "@hookform/resolvers/yup";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  Chip,
  IconButton,
  InputLabel,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import TuneIcon from "@mui/icons-material/Tune";
import { toast } from "react-toastify";
import * as yup from "yup";
import { FormInput } from "../../Components/form-component/FormComponent";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import FormsSkeletons from "../../Components/shared/skeletons/FormsSkeletons";
import { getAllSettings, updateSettings } from "../../core/apis/settingsAPI";
import { conflictCode } from "../../core/helpers/auditJson";
import {
  countryName,
  isIso2CountryCode,
  ISO2_COUNTRY_CODES,
} from "../../core/helpers/countries";
import useLeaveGuard from "../../core/hooks/useLeaveGuard";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import MuiModal from "../../Components/Modals/MuiModal";

export const CACHE_KEY = "APP_CACHE_KEY";
// Same rule as the API for a new key (existing keys keep their name).
export const NEW_KEY_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;
const PAGE_SIZE = 100; // the API caps page_size at 100
export const PROTECTED_KEY_MESSAGE = "This setting can't be deleted";
const ROW_GRID =
  "grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-x-3 gap-y-1 items-start";

// Rows the admin cannot change: editable=false from the API (APP_CACHE_KEY).
// Secret-shaped keys are edited like any other key (user decision
// 2026-10-21, for now).
export const isLockedRow = (row) =>
  row?.editable === false || row?.key === CACHE_KEY;

// Saved rows the API refuses to delete (protected keys): deletable=false.
export const isProtectedRow = (row) =>
  !!row?.created_at && (row?.deletable === false || row?.key === CACHE_KEY);

const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

// Typed values of known keys, same rules as the API (TEOS-134).
export const settingValueError = (key, value) => {
  const text = value ?? "";
  switch (key) {
    case "TOP_COUNTRIES_COUNT": {
      const trimmed = text.trim();
      if (!/^\d+$/.test(trimmed) || Number(trimmed) < 1 || Number(trimmed) > 50)
        return "Enter a whole number from 1 to 50";
      return null;
    }
    case "FORBIDDEN_COUNTRIES": {
      if (text === "") return null;
      const codes = text.split(",");
      if (codes.some((code) => !isIso2CountryCode(code)))
        return "Use ISO 3166-1 alpha-2 country codes (e.g. LB,FR)";
      if (new Set(codes).size !== codes.length)
        return "A country is listed twice";
      return null;
    }
    case "WALLET_TOP_UP_ALERT_RECIPIENTS": {
      const parts = text.split(",").map((part) => part.trim());
      if (!text.trim() || parts.some((part) => !EMAIL.test(part)))
        return "Enter e-mail addresses separated by commas";
      return null;
    }
    case "VOUCHER_MAX_AMOUNT": {
      const number = Number(text.trim());
      if (!text.trim() || !Number.isFinite(number) || number <= 0)
        return "Enter a positive number";
      return null;
    }
    default:
      return null;
  }
};

const schema = yup.object().shape({
  settings: yup.array().of(
    yup.object().shape({
      key: yup
        .string()
        .required()
        .nullable(false)
        .test(
          "new-key-format",
          "Start with a letter; use A-Z, 0-9 and _ (3 to 64 characters)",
          (value, context) =>
            !!context?.parent?.created_at || NEW_KEY_PATTERN.test(value || "")
        ),
      value: yup
        .string()
        .nullable(false)
        .label("Value")
        .test("required", "Value is required", (value, context) =>
          // an empty FORBIDDEN_COUNTRIES means "no forbidden country"
          context?.parent?.key === "FORBIDDEN_COUNTRIES" ? true : !!value
        )
        .test("typed-value", (value, context) => {
          if (isLockedRow(context?.parent)) return true;
          const error = settingValueError(context?.parent?.key, value);
          return error ? context.createError({ message: error }) : true;
        })
        .test(
          "not-negative-number",
          "Value cannot be a negative number",
          (value) => {
            if (!value) return true;

            // check if it is a numeric value
            if (!isNaN(value)) {
              return Number(value) >= 0;
            }

            return true;
          },
        ),
    }),
  ),
});

/*
  The save payload: only new rows and rows whose value changed, plus the keys
  of the removed rows. Read-only rows (the cache key) are never sent.
  Returns the items with the form index of each one, to put a 422 on its row.
*/
export const buildSettingsPayload = (formRows, originalRows, deletedKeys) => {
  const original = Object.fromEntries(
    (originalRows || []).map((row) => [row.key, row])
  );
  const items = [];
  const formIndexes = [];
  (formRows || []).forEach((row, index) => {
    if (isLockedRow(row)) return;
    const key = row?.key?.trim();
    const value = row?.value?.trim() || "";
    const before = original[key];
    if (!before || before.value !== value) {
      items.push({ key, value });
      formIndexes.push(index);
    }
  });
  const deleted_keys = (deletedKeys || []).filter((key) => key !== CACHE_KEY);
  return { payload: { items, deleted_keys }, formIndexes };
};

// Every setting, page after page (the API caps page_size at 100).
export const fetchAllSettings = async () => {
  const first = await getAllSettings({ page: 1, page_size: PAGE_SIZE });
  const rows = [...(first?.data?.data?.data || [])];
  const total = first?.data?.data?.total_count || rows.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  for (let page = 2; page <= pages; page += 1) {
    const next = await getAllSettings({ page, page_size: PAGE_SIZE });
    const data = next?.data?.data?.data || [];
    if (data.length === 0) break;
    rows.push(...data);
  }
  return rows;
};

// "items.3.value: invalid_value, ..." or "items → 3 → value: ..." (pydantic)
const ITEM_ERROR = /items(?:\.|\s*→\s*)(\d+)(?:\.|\s*→\s*)(key|value)\s*:?\s*/;

export const itemErrorOf = (message) => {
  if (typeof message !== "string") return null;
  const match = message.match(ITEM_ERROR);
  if (!match) return null;
  const rest = message.slice(match.index + match[0].length);
  const text = rest.split(/,\s*body\b/)[0].trim();
  return { index: Number(match[1]), field: match[2], message: text || message };
};

const protectedKeysOf = (error) => {
  try {
    const detail = JSON.parse(error?.response?.data?.developerMessage);
    if (Array.isArray(detail?.keys)) return detail.keys;
    return detail?.key ? [detail.key] : [];
  } catch {
    return [];
  }
};

const valueToCodes = (value) =>
  (value || "")
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);

const CountriesSelect = ({ value, onChange, disabled, helperText }) => (
  <Autocomplete
    multiple
    size="small"
    fullWidth
    disabled={disabled}
    options={ISO2_COUNTRY_CODES}
    value={valueToCodes(value)}
    onChange={(event, codes) => onChange(codes.join(","))}
    getOptionLabel={(code) => `${countryName(code)} (${code})`}
    renderTags={(codes, getTagProps) =>
      codes.map((code, index) => {
        const { key, ...tagProps } = getTagProps({ index });
        return <Chip size="small" label={code} key={key} {...tagProps} />;
      })
    }
    renderInput={(params) => (
      <TextField
        {...params}
        placeholder={valueToCodes(value).length ? "" : "Select countries"}
        helperText={helperText}
        inputProps={{ ...params.inputProps, "aria-label": "forbidden countries" }}
      />
    )}
  />
);

const EditSettings = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const canWrite = usePermission(PERMISSIONS.SETTINGS_WRITE);

  const [deletedItems, setDeletedItems] = useState([]);
  const [protectedErrors, setProtectedErrors] = useState([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    setError,
    formState: { isDirty },
  } = useForm({
    resolver: yupResolver(schema),

    defaultValues: {},
    mode: "all",
  });

  const { fields, prepend, append, remove } = useFieldArray({
    control,
    name: "settings",
  });

  const { data: rows, isLoading, isError, error } = useQuery({
    queryKey: ["settings", "all"],
    queryFn: fetchAllSettings,
  });

  useEffect(() => {
    if (rows) {
      reset({ settings: rows });
      setDeletedItems([]);
      setProtectedErrors([]);
    }
  }, [rows, reset]);

  useEffect(() => {
    if (isError && !error?.isForbidden) toast.error("Failed to load settings");
  }, [isError]);

  const hasChanges = isDirty || deletedItems.length > 0;
  const [saved, setSaved] = useState(false);
  // TEOS-221: Back arrow, sidebar links, reload and tab close ask too, not only Cancel.
  const { leaveOpen, requestLeave, confirmLeave, cancelLeave } = useLeaveGuard(
    hasChanges && !saved
  );

  const mutation = useMutation({
    mutationFn: ({ payload }) => updateSettings(payload),
    onSuccess: () => {
      toast.success(`Settings edited successfully`);
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings-history"] });
      setSaved(true);
      navigate(-1);
    },
    onError: (error, { formIndexes }) => {
      const status = error?.response?.status;
      const code = conflictCode(error);
      if (status === 409 && code === "no_change") {
        toast.info("Nothing changed: the settings are already saved");
        return;
      }
      if (status === 409 && code === "protected_key") {
        // Put the refused rows back, with the message on each of them.
        const keys = protectedKeysOf(error);
        const restored = (rows || []).filter((row) => keys.includes(row.key));
        restored.forEach((row) => append(row));
        setDeletedItems((current) => current.filter((key) => !keys.includes(key)));
        setProtectedErrors(keys);
        toast.error(PROTECTED_KEY_MESSAGE);
        return;
      }
      const itemError = itemErrorOf(error?.response?.data?.developerMessage);
      if (itemError && formIndexes?.[itemError.index] !== undefined) {
        setError(`settings.${formIndexes[itemError.index]}.${itemError.field}`, {
          type: "server",
          message: itemError.message,
        });
      }
      toast.error(error?.message || "An error occured");
    },
  });

  const onConfirmSubmit = () => {
    setConfirmOpen(false);
    const { payload, formIndexes } = buildSettingsPayload(
      getValues()?.settings,
      rows,
      deletedItems
    );
    if (payload.items.length === 0 && payload.deleted_keys.length === 0) {
      toast.info("Nothing changed: the settings are already saved");
      return;
    }
    mutation.mutate({ payload, formIndexes });
  };

  const onFormSubmit = handleSubmit(() => {
    // Open confirmation only if validation passes
    setConfirmOpen(true);
  });

  const onCancel = () => requestLeave(-1);

  // New rows go on top so they show up right under the header, no scrolling
  // down a long list to reach them.
  const addSetting = () => prepend({ key: "", value: "" });

  const isSubmitting = mutation.isPending;

  if (isLoading) {
    return <FormsSkeletons />;
  }
  if (!rows) {
    return <NoDataFound text="Failed to load settings" />;
  }

  const renderValueInput = (item, field, error, locked) => {
    const disabled = locked || !canWrite;
    const helperText =
      error?.message ||
      (item?.key === CACHE_KEY
        ? "Rotated by the server, read only"
        : locked
          ? "Read only"
          : "");
    if (item?.key === "FORBIDDEN_COUNTRIES" && !locked) {
      return (
        <CountriesSelect
          value={field.value}
          onChange={field.onChange}
          disabled={disabled}
          helperText={helperText}
        />
      );
    }
    if (item?.key === "TOP_COUNTRIES_COUNT" && !locked) {
      return (
        <FormInput
          {...field}
          type="number"
          placeholder="1 to 50"
          disabled={disabled}
          helperText={helperText}
        />
      );
    }
    return (
      <FormInput
        {...field}
        placeholder="Enter value"
        multiline
        maxRows={6}
        disabled={disabled}
        helperText={helperText}
      />
    );
  };

  return (
    <Card>
      <form
        className={"flex flex-col p-6 gap-[1rem] sm:w-[80%]"}
        onSubmit={(e) => {
          e.preventDefault();
          onFormSubmit();
        }}
      >
        <div className="flex flex-col gap-[1rem]">
          <div
            className={
              "flex flex-row flex-wrap justify-between items-center gap-[0.5rem]"
            }
          >
            <h1>{fields?.length} Configured Settings</h1>
            <div
              className={
                "flex flex-row flex-wrap gap-[0.5rem] justify-end items-center"
              }
            >
              {fields?.length > 0 && canWrite && (
                <Button
                  variant={"outlined"}
                  color="primary"
                  type={"button"}
                  startIcon={<AddIcon />}
                  onClick={addSetting}
                >
                  Add Setting
                </Button>
              )}
              <Button
                variant={"contained"}
                color="secondary"
                type={"button"}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                variant={"outlined"}
                color="secondary"
                type={"button"}
                onClick={() => {
                  setDeletedItems([]);
                  setProtectedErrors([]);
                  reset();
                }}
              >
                Reset
              </Button>
              <Button
                type="submit"
                variant={"contained"}
                color="primary"
                disabled={isSubmitting || !canWrite || !hasChanges}
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            </div>
          </div>

          {fields?.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center gap-3 py-16">
              <Box
                className="flex items-center justify-center w-14 h-14 rounded-2xl"
                sx={{
                  backgroundColor: alpha(theme.palette.primary.main, 0.08),
                  color: theme.palette.primary.main,
                }}
              >
                <TuneIcon />
              </Box>
              <div className="flex flex-col gap-1">
                <Typography variant="h6" component="p" fontWeight={700}>
                  No settings
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start by adding your first setting key and value.
                </Typography>
              </div>
              {canWrite && (
                <Button
                  variant={"contained"}
                  color="primary"
                  type={"button"}
                  startIcon={<AddIcon />}
                  onClick={addSetting}
                >
                  Add Setting
                </Button>
              )}
            </div>
          )}

          {fields?.length > 0 && (
            // One header row on wide screens: every key, value and remove
            // button below lines up on the same columns and top line.
            <div className={`hidden sm:grid ${ROW_GRID}`} aria-hidden="true">
              <InputLabel>Key</InputLabel>
              <InputLabel>Value</InputLabel>
              <span />
            </div>
          )}

          {fields?.map((item, index) => {
            const locked = isLockedRow(item);
            const protectedRow = isProtectedRow(item);
            const refused = protectedErrors.includes(item?.key);
            return (
              <div
                key={item?.id}
                className={ROW_GRID}
                data-testid="setting-row"
              >
                {/* Key Field */}
                <div className="flex flex-col gap-1 min-w-0">
                  <InputLabel className="sm:hidden!">Key</InputLabel>
                  <Controller
                    name={`settings.${index}.key`}
                    control={control}
                    render={({ field, fieldState: { error } }) => (
                      <FormInput
                        {...field}
                        placeholder="Enter key"
                        disabled={!!item?.created_at || !canWrite}
                        helperText={
                          error?.message ||
                          (refused ? PROTECTED_KEY_MESSAGE : "")
                        }
                      />
                    )}
                  />
                  {item?.description && (
                    <Typography variant="caption" color="text.secondary">
                      {item.description}
                    </Typography>
                  )}
                </div>

                {/* Value Field */}
                <div className="flex flex-col gap-1 min-w-0">
                  <InputLabel className="sm:hidden!">Value</InputLabel>
                  <Controller
                    name={`settings.${index}.value`}
                    control={control}
                    render={({ field, fieldState: { error } }) =>
                      renderValueInput(item, field, error, locked)
                    }
                  />
                </div>

                {/* Remove Button: centred on the 40px input line */}
                <div className="flex flex-row justify-center items-center h-10">
                  <Tooltip
                    title={protectedRow ? PROTECTED_KEY_MESSAGE : "Remove"}
                    placement="top"
                  >
                    <span>
                      <IconButton
                        color="error"
                        size="small"
                        aria-label="remove setting"
                        onClick={() => {
                          if (item?.created_at) {
                            setDeletedItems([...deletedItems, item?.key]);
                          }

                          remove(index);
                        }}
                        disabled={
                          fields.length === 1 || protectedRow || !canWrite
                        }
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      </form>
      {confirmOpen && (
        <MuiModal
          open={true}
          onClose={() => setConfirmOpen(false)}
          title={"Notice!"}
          onConfirm={() => onConfirmSubmit()}
        >
          <p className={"text-center"}>
            Are you sure you want to save the changes?
          </p>
        </MuiModal>
      )}
      {leaveOpen && (
        <MuiModal
          open={true}
          onClose={cancelLeave}
          title={"Unsaved changes"}
          confirmButtonName={"Leave"}
          onConfirm={confirmLeave}
        >
          <p className={"text-center"}>
            You have unsaved changes. Leave without saving?
          </p>
        </MuiModal>
      )}
    </Card>
  );
};

export default EditSettings;
