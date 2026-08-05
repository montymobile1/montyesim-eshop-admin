import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import * as yup from "yup";
//COMPONENT
import { Close } from "@mui/icons-material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import { deactivateAllBundles } from "../../../core/apis/bundlesAPI";
import { FormInput } from "../../form-component/FormComponent";

const schema = yup.object().shape({
  reason: yup
    .string()
    .label("Reason")
    .max(500)
    .required()
    .test(
      "not-only-spaces",
      "Reason cannot be only spaces",
      (value) => value != null && value.trim().length > 0,
    ),
});

const STEPS = {
  WARNING: "warning",
  REASON: "reason",
  CONFIRM: "confirm",
};

const DeactivateAllBundles = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(STEPS.WARNING);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userId = useSelector((state) => state.authentication?.user_info?.id);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { isValid },
  } = useForm({
    defaultValues: {
      reason: "",
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const handleDeactivate = () => {
    setIsSubmitting(true);

    deactivateAllBundles({ reason: getValues("reason")?.trim(), userId })
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error);
          return;
        }

        if (res?.data?.success) {
          toast.success(res?.data?.message);
          if (res?.auditError) {
            toast.warn(
              `Bundles deactivated but the audit log failed: ${res.auditError}`,
            );
          }
          onSuccess();
        } else {
          toast.info(res?.data?.message || "No bundle was deactivated.");
        }

        onClose();
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const stepContent = {
    [STEPS.WARNING]: {
      title: "Deactivate All Bundles",
      body: "You are about to deactivate all active bundles. New eSIM purchases will no longer be available. Do you want to continue?",
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
      body: "Confirm the deactivation of all active bundles. This action will immediately prevent new purchases.",
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
