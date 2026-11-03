import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as yup from "yup";
//COMPONENT
import { Close } from "@mui/icons-material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import {
  bulkBundleStatus,
  getApiErrorCode,
} from "../../../core/apis/bundlesAPI";
import { reasonSchema } from "../../../core/helpers/reasonSchema";
import { FormInput } from "../../form-component/FormComponent";

const schema = yup.object().shape({
  reason: reasonSchema(),
});

const STEPS = {
  WARNING: "warning",
  REASON: "reason",
  CONFIRM: "confirm",
};

/*
  One POST /bundles/status/bulk { is_active: false, reason }. The API audits
  the action (operation BULK, with the reason) and rotates APP_CACHE_KEY in
  the same transaction.
  TEOS-291: activeCount (the list's active total) is stated in step 1 and in the
  final confirmation, as Activate All states its inactive count.
*/
const DeactivateAllBundles = ({ activeCount = 0, onClose, onSuccess }) => {
  const [step, setStep] = useState(STEPS.WARNING);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    getValues,
    setError,
    formState: { isValid },
  } = useForm({
    defaultValues: {
      reason: "",
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const handleDeactivate = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    bulkBundleStatus({ is_active: false, reason: getValues("reason") })
      .then((res) => {
        const affected = res?.data?.data?.rows_affected ?? 0;
        toast.success(
          `All active bundles have been successfully deactivated. ${affected} bundle(s) affected.`,
        );
        onSuccess();
        onClose();
      })
      .catch((error) => {
        if (getApiErrorCode(error) === "no_change") {
          toast.info("All bundles are already inactive.");
          onSuccess();
          onClose();
        } else if (error?.response?.status === 422) {
          setError("reason", {
            type: "server",
            message: error?.message,
          });
          setStep(STEPS.REASON);
        } else {
          toast.error(error?.message || "Failed to deactivate bundles");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const stepContent = {
    [STEPS.WARNING]: {
      title: "Deactivate All Bundles",
      body: `You are about to deactivate ${activeCount} active bundle(s). New eSIM purchases will no longer be available. Do you want to continue?`,
      confirmLabel: "Continue",
      onConfirm: () => setStep(STEPS.REASON),
      confirmDisabled: false,
    },
    [STEPS.REASON]: {
      title: "Reason for Deactivation",
      body: "Please enter the reason for deactivating all active bundles. This will be stored in the audit log.",
      confirmLabel: "Continue",
      onConfirm: handleSubmit(() => setStep(STEPS.CONFIRM)),
      confirmDisabled: !isValid,
    },
    [STEPS.CONFIRM]: {
      title: "Final Confirmation",
      body: `Confirm the deactivation of ${activeCount} active bundle(s). This action will immediately prevent new purchases.`,
      confirmLabel: isSubmitting ? "Deactivating..." : "Confirm Deactivation",
      onConfirm: handleDeactivate,
      confirmDisabled: isSubmitting,
    },
  }[step];

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
          <h1 className={"text-center"}>{stepContent.title}</h1>

          <div className={"flex flex-row gap-[0.75rem] items-start"}>
            <WarningAmberIcon color="warning" />
            <p>{stepContent.body}</p>
          </div>

          {step === STEPS.REASON && (
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
                      placeholder="e.g. Bundles are being temporarily disabled due to provider maintenance."
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
          )}

          {step === STEPS.CONFIRM && (
            <div className={"break-words"}>
              <span className={"font-semibold"}>Reason: </span>
              {getValues("reason")?.trim()}
            </div>
          )}

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
              color="primary"
              disabled={stepContent.confirmDisabled}
              onClick={stepContent.onConfirm}
            >
              {stepContent.confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeactivateAllBundles;
