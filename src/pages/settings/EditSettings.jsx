import { yupResolver } from "@hookform/resolvers/yup";
import {
  Box,
  Button,
  Card,
  IconButton,
  InputLabel,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
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
import { useSelector } from "react-redux";
import MuiModal from "../../Components/Modals/MuiModal";

const schema = yup.object().shape({
  settings: yup.array().of(
    yup.object().shape({
      key: yup.string().required().nullable(false),
      value: yup
        .string()
        .required()
        .nullable(false)
        .label("Value")
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

const EditSettings = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const user = useSelector((state) => state.authentication);

  const [deletedItems, setDeletedItems] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const {
    control,
    getValues,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm({
    resolver: yupResolver(schema),

    defaultValues: {},
    mode: "all",
  });

  const { fields, prepend, remove } = useFieldArray({
    control,
    name: "settings",
  });

  useEffect(() => {
    setLoading(true);
    getAllSettings()
      .then((res) => {
        if (res?.error) {
          setData(null);
          toast.error(res?.error);
        } else {
          setData(res?.data);

          reset({ settings: res.data });
          setDeletedItems([]);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [reset]);

  const handleSubmitForm = (payload) => {
    setIsSubmitting(true);

    const settingsPayload =
      payload?.settings?.map((setting) => {
        return {
          key: setting.key,
          value: setting?.value?.trim() || "",
        };
      }) || [];

    updateSettings(settingsPayload, data, deletedItems, user, isDirty)
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error || "An error occured");
        } else {
          toast.success(`Settings edited successfully`);
          navigate(-1);
        }
      })
      .finally(() => {
        setIsSubmitting(false);
        setConfirmOpen(false);
      })
      .catch((error) => {
        toast.error(error?.message || "An error occured");
      });
  };

  const onConfirmSubmit = () => {
    const payload = getValues();
    setConfirmOpen(false);
    handleSubmitForm(payload);
  };

  const onFormSubmit = handleSubmit(() => {
    // Open confirmation only if validation passes
    setConfirmOpen(true);
  });

  // New rows go on top so they show up right under the header, no scrolling
  // down a long list to reach them.
  const addSetting = () => prepend({ key: "", value: "" });

  if (loading) {
    return <FormsSkeletons />;
  }
  if (!loading && !data) {
    return <NoDataFound text="Failed to load settings" />;
  }

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
              {fields?.length > 0 && (
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
                onClick={() => navigate(-1)}
              >
                Cancel
              </Button>
              <Button
                variant={"outlined"}
                color="secondary"
                type={"button"}
                onClick={() => {
                  setDeletedItems([]);
                  reset();
                }}
              >
                Reset
              </Button>
              <Button
                type="submit"
                variant={"contained"}
                color="primary"
                disabled={isSubmitting}
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
                  No settings yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Start by adding your first setting key and value.
                </Typography>
              </div>
              <Button
                variant={"contained"}
                color="primary"
                type={"button"}
                startIcon={<AddIcon />}
                onClick={addSetting}
              >
                Add Setting
              </Button>
            </div>
          )}

          {fields?.map((item, index) => (
            <div
              key={item?.id}
              className="flex flex-row gap-2 w-full items-center"
            >
              {/* Key Field */}
              <div className="flex flex-col gap-1 flex-1">
                <InputLabel>Key</InputLabel>
                <Controller
                  name={`settings.${index}.key`}
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <FormInput
                      {...field}
                      placeholder="Enter key"
                      disabled={item?.created_at}
                      helperText={error?.message}
                    />
                  )}
                />
              </div>

              {/* Value Field */}
              <div className="flex flex-col gap-1 flex-1">
                <InputLabel>Value</InputLabel>
                <Controller
                  name={`settings.${index}.value`}
                  control={control}
                  render={({ field, fieldState: { error } }) => (
                    <FormInput
                      {...field}
                      placeholder="Enter value"
                      helperText={error?.message}
                    />
                  )}
                />
              </div>

              {/* Remove Button */}
              <div className="flex flex-row justify-center items-center w-[40px] mt-6">
                <Tooltip title="Remove" placement="top">
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
                      disabled={fields.length === 1}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </div>
            </div>
          ))}
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
    </Card>
  );
};

export default EditSettings;
