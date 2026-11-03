import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as yup from "yup";
//COMPONENT
import { Close } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import {
  bulkBundleStatus,
  getApiErrorCode,
} from "../../../core/apis/bundlesAPI";
import { reasonSchema } from "../../../core/helpers/reasonSchema";
import { FormInput } from "../../form-component/FormComponent";

// Reason is optional for a bulk activation, unlike the deactivation.
const schema = yup.object().shape({
  reason: reasonSchema({ required: false }),
});

/*
  One POST /bundles/status/bulk { is_active: true, reason? }. The API audits
  the action (operation BULK) and rotates APP_CACHE_KEY in the same transaction.
*/
const ActivateAllBundles = ({ inactiveCount = 0, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, setError } = useForm({
    defaultValues: {
      reason: "",
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const handleSubmitForm = (payload) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    bulkBundleStatus({ is_active: true, reason: payload?.reason })
      .then((res) => {
        const affected = res?.data?.data?.rows_affected ?? 0;
        toast.success(
          `All bundles have been successfully activated. ${affected} bundle(s) affected.`,
        );
        onSuccess();
        onClose();
      })
      .catch((error) => {
        if (getApiErrorCode(error) === "no_change") {
          toast.info("All bundles are already active.");
          onSuccess();
          onClose();
        } else if (error?.response?.status === 422) {
          setError("reason", {
            type: "server",
            message: error?.message,
          });
        } else {
          toast.error(error?.message || "Failed to activate bundles");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
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

        <form
          className={"flex flex-col gap-[1rem] "}
          onSubmit={handleSubmit(handleSubmitForm)}
        >
          <h1 className={"text-center"}>{"Activate All Bundles"}</h1>

          <div className={"flex flex-row gap-[0.75rem] items-start"}>
            <InfoOutlinedIcon color="primary" />
            <p>
              {`You are about to activate ${inactiveCount} inactive bundle(s). They will become available for purchase again. Do you want to continue?`}
            </p>
          </div>

          <div className="label-input-wrapper">
            <Controller
              name="reason"
              control={control}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <label className="w-full">
                  Reason (optional)
                  <FormInput
                    placeholder="e.g. Provider maintenance is over."
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
              type="submit"
              variant={"contained"}
              sx={{ width: "100%" }}
              color="primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Activating..." : "Confirm Activation"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ActivateAllBundles;
