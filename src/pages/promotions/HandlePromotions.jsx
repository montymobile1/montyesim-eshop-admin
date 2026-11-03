import { yupResolver } from "@hookform/resolvers/yup";
import { Info } from "@mui/icons-material";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormHelperText,
  Tooltip,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { apiDateToLocalDay } from "../../core/helpers/apiDates";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as yup from "yup";
import {
  FormDate,
  FormDateRange,
  FormInput,
} from "../../Components/form-component/FormComponent";
import MuiModal from "../../Components/Modals/MuiModal";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import LookupSelect from "../../Components/shared/lookup-select/LookupSelect";
import FormsSkeletons from "../../Components/shared/skeletons/FormsSkeletons";
import {
  getBundlesLookup,
  getPromotionRulesLookup,
} from "../../core/apis/lookupsAPI";
import {
  AddPromotion,
  editPromotion,
  getApiErrorCode,
  getPromotionById,
} from "../../core/apis/promotionsAPI";
import { apiFieldErrors } from "../../core/helpers/apiFieldErrors";
import useLeaveGuard from "../../core/hooks/useLeaveGuard";
import usePermission from "../../core/hooks/usePermission";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import {
  bundleOptions,
  isAmountRule,
  ruleOption,
  valueUnit,
} from "./promotionHelpers";

// TEOS-230: API field of a 422 -> form field it is shown under.
const API_FIELDS = {
  name: "name",
  code: "code",
  rule_id: "rule_id",
  amount: "amount",
  valid_from: "duration",
  valid_to: "duration",
  bundle_codes: "bundle_codes",
};

/* EXPLANATION : The limit of 5 bundle codes is based on each code being up to 36 characters plus
   4 commas separating them, fitting within the database varchar field limit of 200 characters.
   Same rules as the API (MS-5052). */
const schema = yup.object().shape({
  name: yup
    .string()
    .label("Name")
    .max(100)
    .min(2)
    .required()
    .nullable()
    .test(
      "not-only-spaces",
      "Name cannot be only spaces",
      (value) => value == null || value.trim().length > 0
    ),
  code: yup
    .string()
    .label("Code")
    .required()
    .nullable()
    .matches(
      /^[A-Za-z0-9_-]{2,50}$/,
      "Code must be 2 to 50 letters, digits, _ or -"
    ),
  rule_id: yup.object().label("Rule").required().nullable(),
  amount: yup
    .number()
    .label("Value")
    .nullable()
    .transform((value, original) =>
      original === "" || original === null || Number.isNaN(value) ? null : value
    )
    .when("rule_id", {
      is: (rule) => isAmountRule(rule) !== false,
      then: (s) => s.required("Value is required").moreThan(0, "Value must be greater than 0"),
      otherwise: (s) =>
        s
          .required("Value is required")
          .moreThan(0, "Value must be greater than 0")
          .max(100, "Value must be at most 100"),
    }),
  duration: yup
    .array()
    .nullable()
    .label("Duration")
    .required("Duration is required")
    .length(2, "Duration must have exactly 2 elements")
    .test("at-least-one", "From and To are required", (value) => {
      if (!Array.isArray(value)) return false;
      const [from, to] = value;
      return !(from == null || to == null);
    })
    .test("in-order", "End date must be after the start date", (value) => {
      if (!Array.isArray(value)) return true;
      const [from, to] = value;
      if (!from || !to) return true;
      return !dayjs(to).isBefore(dayjs(from), "day");
    }),
  bundle_codes: yup.array().label("Bundles").nullable().max(5),
});

const LOCKED_NOTE = "Locked: this promotion has been used";

// Start of the first day / end of the last day, in local time, sent as UTC ISO strings.
const startOfDayIso = (day) => dayjs(day).startOf("day").toISOString();
const endOfDayIso = (day) => dayjs(day).endOf("day").toISOString();

/*
  MS-5053: add / edit on POST / PUT /promotions. No uniqueness pre-check: a 409
  duplicate_code / duplicate_name lands on its field. Once a promotion has been used,
  code, rule, value and start date are locked (409 promotion_used otherwise).
*/
const HandlePromotions = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const canWrite = usePermission(PERMISSIONS.PROMOTIONS_WRITE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm({
    defaultValues: {
      name: "",
      code: "",
      rule_id: null,
      amount: null,
      duration: [null, null],
      bundle_codes: [],
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["promotions", "detail", id],
    queryFn: () => getPromotionById(id).then((res) => res?.data?.data),
    enabled: !!id,
  });

  // TEOS-231: Back arrow, sidebar links, reload and tab close ask too, not only Cancel.
  const { leaveOpen, requestLeave, confirmLeave, cancelLeave } = useLeaveGuard(
    isDirty && !saved
  );

  const locked = !!id && (data?.times_used || 0) > 0;
  const readOnly = !canWrite;

  useEffect(() => {
    if (data) {
      reset({
        name: data?.name || "",
        code: data?.code || "",
        rule_id: ruleOption(data?.rule),
        amount: data?.amount ?? null,
        // TEOS-229: the API sends UTC without an offset; show the local day.
        duration: [apiDateToLocalDay(data?.valid_from), apiDateToLocalDay(data?.valid_to)],
        bundle_codes: bundleOptions(data?.bundle_codes),
      });
    }
  }, [data]);

  const selectedRule = useWatch({ control, name: "rule_id" });

  const unit = useMemo(() => (selectedRule ? valueUnit(selectedRule) : ""), [selectedRule]);
  const label = useMemo(() => {
    if (!selectedRule) return "Amount/Percentage";
    return isAmountRule(selectedRule) === false ? "Percentage" : "Amount";
  }, [selectedRule]);

  const handleSubmitForm = (payload) => {
    if (isSubmitting || readOnly) return;
    setIsSubmitting(true);
    const [from, to] = payload?.duration || [];
    // TEOS-229: on edit, a date is sent only when the admin changed its day, so an
    // untouched date is never rewritten.
    const fromChanged = !!from && from !== apiDateToLocalDay(data?.valid_from);
    const toChanged = !!to && to !== apiDateToLocalDay(data?.valid_to);
    const bundle_codes = (payload?.bundle_codes || [])
      .map((el) => el?.value)
      .filter(Boolean);
    const request = id
      ? editPromotion({
          id,
          name: payload?.name,
          bundle_codes,
          valid_to: toChanged ? endOfDayIso(to) : undefined,
          ...(!locked && {
            code: payload?.code,
            rule_id: payload?.rule_id?.value,
            amount: payload?.amount,
            valid_from: fromChanged ? startOfDayIso(from) : undefined,
          }),
        })
      : AddPromotion({
          name: payload?.name,
          code: payload?.code,
          rule_id: payload?.rule_id?.value,
          amount: payload?.amount,
          valid_from: startOfDayIso(from),
          valid_to: endOfDayIso(to),
          bundle_codes,
        });

    request
      .then(() => {
        toast.success(`Promotion ${id ? "edited" : "added"} successfully`);
        queryClient.invalidateQueries({ queryKey: ["promotions"] });
        setSaved(true);
        // TEOS-285: always back to the list, whatever page (or no page) the form was opened from
        navigate("/promotions");
      })
      .catch((error) => {
        const code = getApiErrorCode(error);
        if (code === "duplicate_code") {
          setError("code", { type: "server", message: "Code is not unique" });
        } else if (code === "duplicate_name") {
          setError("name", { type: "server", message: "Name is not unique" });
        } else if (code === "promotion_used") {
          toast.error(
            "This promotion has been used: its code, rule, value and start date can no longer change"
          );
          refetch();
        } else if (!showFieldErrors(error)) {
          toast.error(error?.message || "An error occured");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  // TEOS-230: a 422 lands under its fields; false when none of its parts names a form field.
  const showFieldErrors = (error) => {
    const shown = apiFieldErrors(error).filter((item) => API_FIELDS[item.field]);
    shown.forEach((item) =>
      setError(API_FIELDS[item.field], { type: "server", message: item.message })
    );
    return shown.length > 0;
  };

  // MS-5053 case 21: leaving with unsaved changes asks for confirmation.
  const onCancel = () => requestLeave(-1);

  if (id && isLoading) {
    return <FormsSkeletons />;
  }
  if (id && isError) {
    return (
      <Card>
        <CardContent>
          <NoDataFound
            text={
              error?.response?.status === 404
                ? "Promotion not found"
                : "Invalid ID or promotion data not loaded. Please try again"
            }
          />
        </CardContent>
      </Card>
    );
  }

  const lockedField = locked || readOnly;

  return (
    <Card>
      <form
        className={"flex flex-col p-6 gap-[1rem]"}
        onSubmit={handleSubmit(handleSubmitForm)}
      >
        {locked && (
          <Alert severity="info" role="note">
            {LOCKED_NOTE} ({data?.times_used} times). Only the name, the bundles
            and the end date can change.
          </Alert>
        )}
        {readOnly && (
          <Alert severity="warning">
            You do not have permission to edit promotions.
          </Alert>
        )}
        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h6 className="px-2">Main Info</h6>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>

        <div className={"flex flex-wrap items-baseline gap-[1rem]"}>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="name">Name* </label>
            <Controller
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormInput
                  id={"name"}
                  placeholder={"Enter Name"}
                  value={value}
                  onChange={onChange}
                  disabled={readOnly}
                  helperText={error?.message}
                />
              )}
              name="name"
              control={control}
            />
          </div>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="code">Code* </label>
            <Controller
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormInput
                  id={"code"}
                  placeholder={"Enter Code"}
                  value={value}
                  onChange={onChange}
                  disabled={lockedField}
                  helperText={error?.message || (locked ? LOCKED_NOTE : "")}
                />
              )}
              name="code"
              control={control}
            />
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h6 className="px-2">Rule & Duration</h6>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>
        <div className={"flex flex-wrap items-baseline gap-[1rem]"}>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="rule-select">Rule* </label>
            <Controller
              render={({ field: { onChange, value } }) => (
                <LookupSelect
                  inputId="rule-select"
                  fetcher={getPromotionRulesLookup}
                  permission={PERMISSIONS.RULES_READ}
                  value={value || null}
                  placeholder="Select Rule"
                  onChange={(option) => {
                    onChange(option);
                    setValue("amount", null, { shouldValidate: true });
                  }}
                  isDisabled={lockedField}
                  menuPortalTarget={
                    typeof window === "undefined" ? undefined : document.body
                  }
                  menuPosition="fixed"
                />
              )}
              name="rule_id"
              control={control}
            />
            {(errors?.rule_id?.message || locked) && (
              <FormHelperText error={!!errors?.rule_id?.message}>
                {errors?.rule_id?.message || LOCKED_NOTE}
              </FormHelperText>
            )}
          </div>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="amount">{label}* </label>
            <Controller
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormInput
                  id={"amount"}
                  type={"number"}
                  placeholder={"Enter Value"}
                  value={value ?? ""}
                  onChange={(value) => onChange(value === "" ? null : value)}
                  disabled={lockedField}
                  helperText={error?.message || (locked ? LOCKED_NOTE : "")}
                  endAdornment={unit}
                />
              )}
              name="amount"
              control={control}
            />
          </div>

          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="duration">Duration* </label>
            <Controller
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) =>
                locked ? (
                  // the note goes under the input, so the input lines up with its neighbours
                  <div className="flex flex-col gap-1">
                    <FormDate
                      placeholder={"Select end date"}
                      value={value?.[1] || ""}
                      onChange={(day) => onChange([value?.[0] || null, day || null])}
                      disabled={readOnly}
                      helperText={error?.message}
                    />
                    <span className="text-sm">
                      From {value?.[0] ? dayjs(value[0]).format("DD-MM-YYYY") : "N/A"}{" "}
                      ({LOCKED_NOTE.toLowerCase()})
                    </span>
                  </div>
                ) : (
                  <FormDateRange
                    placeholder={"Select Duration"}
                    value={value}
                    onChange={onChange}
                    disabled={readOnly}
                    helperText={error?.message}
                  />
                )
              }
              name="duration"
              control={control}
            />
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h6 className="px-2">Application</h6>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>
        <div className={"flex flex-wrap items-baseline gap-[1rem]"}>
          <div className={"flex-1 min-w-[200px]"}>
            <label
              htmlFor="bundles-select"
              className={"flex flex-row items-center"}
            >
              Bundles{" "}
              <Tooltip
                title={`If no bundle is selected, the promotion will be applied to all bundles (at most 5)`}
              >
                <span className={"cursor-pointer"}>
                  <Info fontSize="small" />
                </span>
              </Tooltip>
            </label>
            <Controller
              render={({ field: { onChange, value } }) => (
                <LookupSelect
                  inputId="bundles-select"
                  isMulti
                  fetcher={getBundlesLookup}
                  valueKey="bundle_code"
                  permission={PERMISSIONS.BUNDLES_READ}
                  value={value || []}
                  placeholder="Select Bundle"
                  onChange={(options) => onChange((options || []).slice(0, 5))}
                  isDisabled={readOnly}
                  isOptionDisabled={() => (value || []).length >= 5}
                  menuPortalTarget={
                    typeof window === "undefined" ? undefined : document.body
                  }
                  menuPosition="fixed"
                />
              )}
              name="bundle_codes"
              control={control}
            />
            {errors?.bundle_codes?.message && (
              <FormHelperText error>{errors?.bundle_codes?.message}</FormHelperText>
            )}
          </div>
        </div>
        <div className={"flex flex-row gap-[0.5rem] justify-end items-center"}>
          <Button
            variant={"contained"}
            color="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={"contained"}
            color="primary"
            disabled={isSubmitting || readOnly}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </form>
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

export default HandlePromotions;
