import { yupResolver } from "@hookform/resolvers/yup";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import * as yup from "yup";
//COMPONENT
import { Close } from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import { activateAllBundles } from "../../../core/apis/bundlesAPI";
import { FormInput } from "../../form-component/FormComponent";

// Reason is optional for a bulk activation, unlike the deactivation.
const schema = yup.object().shape({
  reason: yup.string().label("Reason").max(500).nullable(),
});

const ActivateAllBundles = ({ inactiveCount = 0, onClose, onSuccess }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const userId = useSelector((state) => state.authentication?.user_info?.id);

  const { control, handleSubmit } = useForm({
    defaultValues: {
      reason: "",
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const handleSubmitForm = (payload) => {
    setIsSubmitting(true);

    activateAllBundles({ reason: payload?.reason?.trim() || null, userId })
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error);
          return;
        }

        if (res?.data?.success) {
          toast.success(res?.data?.message);
          if (res?.auditError) {
            toast.warn(
              `Bundles activated but the audit log failed: ${res.auditError}`
            );
          }
          onSuccess();
        } else {
          toast.info(res?.data?.message || "No bundle was activated.");
        }

        onClose();
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
