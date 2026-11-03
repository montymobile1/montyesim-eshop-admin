import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "react-toastify";
import * as yup from "yup";
//COMPONENT
import { Close } from "@mui/icons-material";
import { Button, Dialog, DialogContent, IconButton } from "@mui/material";
import {
  getApiErrorCode,
  updateBundleTitle,
} from "../../../core/apis/bundlesAPI";
import { FormInput } from "../../form-component/FormComponent";

// Same limit as the API and the bundle table (60 characters).
const schema = yup.object().shape({
  bundle_name: yup
    .string()
    .label("Name")
    .max(60)
    .required()
    .nullable()
    .test(
      "not-only-spaces",
      "Name cannot be only spaces",
      (value) => value == null || value.trim().length > 0
    ),
});

/*
  One PATCH /bundles/{id}. The API audits the rename and rotates APP_CACHE_KEY
  in the same transaction, only when the update succeeded.
*/
const UpdateBundleName = ({ onClose, data, refetchData }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { control, handleSubmit, reset, setError } = useForm({
    defaultValues: {
      bundle_name: "",
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  const handleSubmitForm = (payload) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    updateBundleTitle({ id: data?.id, bundle_name: payload?.bundle_name?.trim() })
      .then(() => {
        toast.success("Bundle display name updated successfully");
        refetchData();
        onClose();
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (getApiErrorCode(error) === "no_change") {
          toast.info("The display name is unchanged.");
          onClose();
        } else if (status === 404) {
          toast.info("This bundle no longer exists.");
          refetchData();
          onClose();
        } else if (status === 422) {
          setError("bundle_name", {
            type: "server",
            message: error?.message,
          });
        } else {
          toast.error(error?.message || "Failed to update the display name");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  useEffect(() => {
    if (data) {
      reset({ bundle_name: data?.bundle_name || "" });
    }
  }, [data]);
  return (
    <Dialog open={true} maxWidth="sm" fullWidth>
      <DialogContent className="flex flex-col gap-[1rem] xs:!px-8 !py-10 ">
        <div className={"flex flex-row justify-end"}>
          <IconButton
            aria-label="close"
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
          <h1 className={"text-center"}>{"Update Bundle Display Name"}</h1>
          <div className="label-input-wrapper">
            <Controller
              name="bundle_name"
              control={control}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <label className="w-full">
                  Display Name*
                  <FormInput
                    placeholder="Enter display name"
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
              onClick={() => onClose()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant={"contained"}
              sx={{ width: "100%" }}
              color="primary"
            >
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpdateBundleName;
