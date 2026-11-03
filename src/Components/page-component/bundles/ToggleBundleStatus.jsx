import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as yup from "yup";
//COMPONENT
import { Close } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import {
  getApiErrorCode,
  toggleBundleStatus,
} from "../../../core/apis/bundlesAPI";
import { reasonSchema } from "../../../core/helpers/reasonSchema";
import { FormInput } from "../../form-component/FormComponent";

const schema = yup.object().shape({
  reason: reasonSchema(),
});

const STEPS = {
  REASON: "reason",
  CONFIRM: "confirm",
};

/*
  One PATCH /bundles/{id}/status. The API writes the audit row (with the reason)
  and rotates APP_CACHE_KEY in the same transaction, so there is no audit or
  cache code here any more.
*/
const ToggleBundleStatus = ({ bundle, onClose, onSuccess }) => {
  const [step, setStep] = useState(STEPS.REASON);
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

  const isActive = !!bundle?.is_active;
  const verb = isActive ? "Deactivate" : "Activate";
  const noun = isActive ? "Deactivation" : "Activation";
  const progressLabel = isActive ? "Deactivating..." : "Activating...";
  const bundleLabel =
    bundle?.bundle_name || bundle?.data?.bundle_name || bundle?.id;

  const handleToggle = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    toggleBundleStatus({
      id: bundle?.id,
      is_active: !isActive,
      reason: getValues("reason"),
    })
      .then(() => {
        toast.success(
          isActive
            ? "The bundle has been successfully deactivated."
            : "The bundle has been successfully activated.",
        );
        onSuccess();
        onClose();
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (getApiErrorCode(error) === "no_change") {
          toast.info(
            `This bundle is already ${isActive ? "inactive" : "active"}.`,
          );
          onSuccess();
          onClose();
        } else if (status === 404) {
          toast.info("This bundle no longer exists.");
          onSuccess();
          onClose();
        } else if (status === 422) {
          setError("reason", {
            type: "server",
            message: error?.message,
          });
          setStep(STEPS.REASON);
        } else {
          toast.error(error?.message || "Failed to update the bundle status");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  const stepContent = {
    [STEPS.REASON]: {
      title: `${verb} Bundle`,
      body: isActive
        ? `You are about to deactivate "${bundleLabel}". It will no longer be available for purchase. Please enter the reason, it will be stored in the audit log.`
        : `You are about to activate "${bundleLabel}". It will become available for purchase again. Please enter the reason, it will be stored in the audit log.`,
      confirmLabel: "Continue",
      onConfirm: handleSubmit(() => setStep(STEPS.CONFIRM)),
      confirmDisabled: !isValid,
    },
    [STEPS.CONFIRM]: {
      title: `Confirm ${noun}`,
      body: isActive
        ? `Confirm the deactivation of "${bundleLabel}". This action will immediately prevent new purchases of this bundle.`
        : `Confirm the activation of "${bundleLabel}". This action will immediately make it available for purchase.`,
      confirmLabel: isSubmitting ? progressLabel : `Confirm ${noun}`,
      onConfirm: handleToggle,
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
            {isActive ? (
              <WarningAmberIcon color="warning" />
            ) : (
              <InfoOutlinedIcon color="primary" />
            )}
            <p className={"break-words"}>{stepContent.body}</p>
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
                      placeholder={
                        isActive
                          ? "e.g. Bundle temporarily disabled due to provider maintenance."
                          : "e.g. Provider maintenance is over."
                      }
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
              color={"primary"}
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

export default ToggleBundleStatus;
