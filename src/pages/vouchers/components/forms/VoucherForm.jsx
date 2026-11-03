import { yupResolver } from "@hookform/resolvers/yup";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import * as yup from "yup";
import {
  FormDate,
  FormInput,
} from "../../../../Components/form-component/FormComponent";
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { DefaultCurrency } from "../../../../core/vairables/EnumData";
import {
  addVoucher,
  getApiErrorCode,
} from "../../../../core/apis/vouchersAPI";
import { copyToClipboard } from "../../../../core/helpers/clipboard";
import { toast } from "react-toastify";
import dayjs from "dayjs";

// Same rule as the API (TEOS-133): letters, digits and -, 4 to 32 characters;
// stored upper case.
export const VOUCHER_CODE_PATTERN = /^[A-Za-z0-9-]{4,32}$/;
export const VOUCHER_CODE_MESSAGE = "Code must be 4 to 32 letters, digits or -";

const schema = yup.object().shape({
  generate: yup.boolean(),
  code: yup
    .string()
    .trim()
    .when("generate", {
      is: true,
      then: (rule) => rule.notRequired(),
      otherwise: (rule) =>
        rule
          .required("Code name is required")
          .matches(VOUCHER_CODE_PATTERN, VOUCHER_CODE_MESSAGE),
    }),
  amount: yup
    .number()
    .typeError("Amount must be a number")
    .positive("Amount must be positive")
    .required("Amount is required"),
  expired_at: yup
    .string()
    .trim()
    .nullable()
    .required("Expiry date is required")
    .test(
      "is-today-or-future",
      "Expiry date must be today or later",
      (value) => {
        if (!value) return false;
        // compared by local day: today is allowed (valid until the end of the day, TEOS-214)
        const inputDate = dayjs(value);
        return inputDate.isValid() && !inputDate.isBefore(dayjs(), "day");
      }
    ),
});

// "amount: must be at most 1e+06 (VOUCHER_MAX_AMOUNT)" (422 from the API)
const amountErrorOf = (error) => {
  const message = error?.response?.data?.developerMessage;
  if (typeof message !== "string" || !/amount/i.test(message)) return null;
  const max = message.match(/at most ([\d.e+]+)/i);
  return max
    ? `Amount must be at most ${Number(max[1]).toLocaleString()}`
    : "Amount is not valid";
};

export default function VoucherForm({ voucher = null, onSuccess, OnCancel }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState(null);

  const {
    handleSubmit,
    control,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      generate: false,
      code: voucher?.code || "",
      amount: voucher?.amount || "",
      expired_at: voucher?.expired_at || "",
    },
  });

  const generate = watch("generate");

  // Uniqueness is checked by the API: 409 duplicate_code lands on the code field.
  const onSubmit = (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const { amount, expired_at } = data;
    const code = data.generate ? undefined : data.code?.trim().toUpperCase();

    // TEOS-215: the API refuses an amount sent as a string
    addVoucher({ code, amount: Number(amount), expired_at })
      .then((res) => {
        toast.success("Voucher created successfully");
        const saved = res?.data?.data;
        setCreated(saved?.code ? saved : { code: code || "" });
        onSuccess?.(saved || data);
      })
      .catch((error) => {
        const amountError = amountErrorOf(error);
        if (getApiErrorCode(error) === "duplicate_code") {
          setError("code", { type: "server", message: "Code is not unique" });
        } else if (amountError) {
          setError("amount", { type: "server", message: amountError });
        } else {
          toast.error(
            error?.message || "An error occurred while inserting voucher"
          );
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const OnClose = () => {
    OnCancel?.();
  };

  if (created) {
    // The new code (server-generated or typed), ready to share.
    return (
      <div className="flex flex-col gap-4 w-full">
        <Typography>Voucher created. Its code:</Typography>
        <div className="flex flex-row items-center gap-2">
          <Typography
            component="span"
            className="font-mono text-lg font-semibold"
            data-testid="created-voucher-code"
          >
            {created.code}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon fontSize="small" />}
            onClick={() => copyToClipboard(created.code, "Code copied")}
          >
            Copy
          </Button>
        </div>
        <div className="flex justify-end">
          <Button variant="contained" color="primary" onClick={OnClose}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-4 w-full"
    >
      <div>
        <label
          htmlFor={"code"}
          className="block mb-1 text-sm font-medium text-gray-200"
        >
          Code
        </label>
        <Controller
          id={"code"}
          name="code"
          control={control}
          render={({ field: { onChange, value }, fieldState: { error } }) => (
            <FormInput
              placeholder={generate ? "Generated by the server" : "Enter Code"}
              value={generate ? "" : value}
              onChange={onChange}
              disabled={generate}
              helperText={error?.message}
            />
          )}
        />
        <Controller
          name="generate"
          control={control}
          render={({ field: { onChange, value } }) => (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={!!value}
                  onChange={(e) => onChange(e.target.checked)}
                />
              }
              label="Generate for me"
            />
          )}
        />
      </div>

      <div>
        <label
          htmlFor="amount"
          className="block mb-1 text-sm font-medium text-gray-200"
        >
          Amount
        </label>
        <Controller
          id={"amount"}
          name="amount"
          control={control}
          render={({ field }) => (
            <FormInput
              {...field}
              placeholder="Enter amount"
              type="number"
              endAdornment={DefaultCurrency}
              helperText={errors.amount?.message}
            />
          )}
        />
      </div>

      <div>
        <label
          htmlFor="expired_at"
          className="block mb-1 text-sm font-medium text-gray-200"
        >
          Expire At
        </label>
        <Controller
          name="expired_at"
          id={"expired_at"}
          control={control}
          render={({ field }) => (
            <FormDate
              {...field}
              placeholder="Select expiry date"
              helperText={errors.expired_at?.message}
            />
          )}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="contained" color="secondary" onClick={OnClose}>
          Cancel
        </Button>

        <Button
          variant="contained"
          color="primary"
          type="submit"
          disabled={isSubmitting}
          startIcon={
            isSubmitting && <CircularProgress size={18} color="inherit" />
          }
        >
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}
