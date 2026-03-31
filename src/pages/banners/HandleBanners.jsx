import { yupResolver } from "@hookform/resolvers/yup";
import { Check } from "@mui/icons-material";
import CloseIcon from "@mui/icons-material/Close";
import InfoIcon from "@mui/icons-material/Info";
import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useDebouncedCallback } from "use-debounce";
import * as yup from "yup";
import {
  FormDropdownList,
  FormInput,
  FormSingleImageUpload,
} from "../../Components/form-component/FormComponent";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import FormsSkeletons from "../../Components/shared/skeletons/FormsSkeletons";

import {
  AddBanner,
  checkTitleUnique,
  editBanner,
  getBannerById,
} from "../../core/apis/bannersAPI";
import { actionData, platformData } from "../../core/vairables/EnumData";

let fileTypes = ["png", "jpg", "jpeg", "svg"];
const schema = yup.object().shape({
  title: yup
    .string()
    .label("Title")
    .max(100)
    .min(2)
    .required("Title is required"),
  description: yup
    .string()
    .label("Description")
    .max(500)
    .min(2)
    .required("Description is required"),
  action: yup.object().nullable().label("Action"),
  platform: yup.object().nullable().label("Platform"),
  image: yup.mixed().nullable().label("Image"),
});

const HandleBanners = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [titleUnique, setTitleUnique] = useState({
    loading: false,
    check: false,
    message: "",
  });

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      title: "",
      description: "",
      action: null,
      platform: null,
      image: null,
    },
    resolver: yupResolver(schema),
    mode: "all",
  });

  useEffect(() => {
    if (id) {
      setLoading(true);
      getBannerById(id)
        .then((res) => {
          if (res?.error) {
            setData(null);
            toast.error(res?.error);
          } else {
            setData(res?.data);
            reset({
              title: res?.data?.title || "",
              description: res?.data?.description || "",
              platform:
                platformData.find((plat) => plat.id === res?.data?.platform) ||
                null,
              amount: res?.data?.amount || null,
              action:
                actionData.find((act) => act.id === res?.data?.action) || null,
              image: res?.data?.image || null,
            });
            checkTitleUniqueness(res?.data?.title, id);
          }
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, []);

  const handleSubmitForm = (payload) => {
    if (titleUnique?.check) {
      setIsSubmitting(true);
      let handleAPI = id ? editBanner : AddBanner;

      handleAPI({
        ...payload,
        platform: payload?.platform?.id,
        action: payload?.action?.id,

        ...(id && { id: id }),
      })
        .then((res) => {
          if (res?.error) {
            toast.error(res?.error || "An error occured");
          } else {
            toast.success(`Banner ${id ? "edited" : "added"} successfully`);
            navigate(-1);
          }
        })
        .finally(() => {
          setIsSubmitting(false);
        })
        .catch((error) => {
          toast.error(error?.message || "An error occured");
        });
    } else {
      toast.error("Title must be unique");
    }
  };

  const debouncedTitle = useDebouncedCallback(
    (value) => {
      checkTitleUniqueness(value, id);
    },

    500
  );

  const checkTitleUniqueness = (value, id) => {
    setTitleUnique({
      ...titleUnique,
      loading: true,
    });
    if (errors?.name) {
      setTitleUnique({
        check: false,
        message: errors?.name?.message,
        loading: false,
      });
    } else {
      checkTitleUnique(value, id).then((res) => {
        setTitleUnique({
          check: res?.status == 200 && res?.data?.length === 0,
          message:
            res?.data?.length === 0
              ? res?.error || "Name is unique"
              : "Name is not unique",
          loading: false,
        });
      });
    }
  };

  const TitleCheck = useMemo(() => {
    if (titleUnique?.check) {
      return <Check color="success" sx={{ cursor: "default" }} />;
    } else {
      return <CloseIcon color="error" sx={{ cursor: "default" }} />;
    }
  }, [titleUnique?.check]);

  const AspectRatioDisplay = useMemo(() => {
    if (watch("platform")?.id === "mobile") {
      return { display: "2:1", value: 2 / 1 };
    } else if (watch("platform")?.id === "web") {
      return { display: "10:3", value: 10 / 3 };
    } else {
      return { display: "16:3", value: 16 / 3 };
    }
  }, [watch("platform")?.id]);

  if (id && loading) {
    return <FormsSkeletons />;
  }
  if (!loading && !data && id) {
    return <NoDataFound text="Invalid Banner ID" />;
  }

  return (
    <Card>
      <form
        className={"flex flex-col p-6 gap-[1rem]"}
        onSubmit={handleSubmit(handleSubmitForm)}
      >
        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h6 className="px-2">Main Info</h6>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>
        <div className={"flex flex-wrap gap-[1rem]"}>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="platform">Platform*</label>
            <Controller
              id={"platform"}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormDropdownList
                  data={platformData || []}
                  value={value}
                  disabled={id}
                  onChange={(selected) => {
                    onChange(selected);
                    // Reset all fields when platform changes
                    reset({
                      title: "",
                      description: "",
                      action: null,
                      platform: selected,
                      image: null,
                    });
                  }}
                  placeholder={"Select Platform"}
                  helperText={error?.message}
                  accessName="title"
                  accessValue="id"
                />
              )}
              name="platform"
              control={control}
            />
          </div>

          {/* Title TextArea */}
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="title">Title*</label>
            <Controller
              id={"title"}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormInput
                  placeholder={"Enter Title"}
                  value={value}
                  onChange={(value) => {
                    onChange(value);
                    debouncedTitle(value);
                  }}
                  minRows={2}
                  disabled={id}
                  endAdornment={
                    value && (
                      <Tooltip title={titleUnique?.message}>
                        {titleUnique?.loading ? (
                          <CircularProgress
                            size="20px"
                            color="primary"
                            sx={{ cursor: "default" }}
                          />
                        ) : (
                          TitleCheck
                        )}
                      </Tooltip>
                    )
                  }
                  helperText={error?.message}
                />
              )}
              name="title"
              control={control}
            />
          </div>
          {/* Description TextArea */}
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="description">Description*</label>
            <Controller
              id={"description"}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormInput
                  placeholder={"Enter Description"}
                  value={value}
                  onChange={onChange}
                  helperText={error?.message}
                  type="text"
                  multiline
                  minRows={3}
                />
              )}
              name="description"
              control={control}
            />
          </div>
          {/* Action Dropdown */}
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="action">Action*</label>
            <Controller
              id={"action"}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormDropdownList
                  data={actionData || []}
                  value={value}
                  onChange={onChange}
                  placeholder={"Select Action"}
                  helperText={error?.message}
                  accessName="title"
                  accessValue="id"
                />
              )}
              name="action"
              control={control}
            />
          </div>
        </div>
        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h6 className="px-2">Image</h6>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>
        <div className={"flex flex-wrap gap-[1rem]"}>
          <div className={"flex-1 min-w-[200px]"}>
            <label htmlFor="image">
              Image*{" "}
              {watch("platform")?.id && (
                <Tooltip
                  title={
                    <div className="file-requirements-tooltip">
                      <div>Requirements</div>
                      <li>{fileTypes.toString()}</li>
                      <li>Aspect Ratio : {AspectRatioDisplay?.display}</li>
                    </div>
                  }
                >
                  <span className="cursor-pointer">
                    <InfoIcon />
                  </span>
                </Tooltip>
              )}
            </label>
            <Controller
              id={"image"}
              render={({
                field: { onChange, value },
                fieldState: { error },
              }) => (
                <FormSingleImageUpload
                  value={value}
                  downloadTitle={"Upload Image"}
                  onChange={onChange}
                  aspectRatio={AspectRatioDisplay?.value}
                  helperText={error?.message}
                />
              )}
              name="image"
              control={control}
            />
          </div>
        </div>

        <div className={"flex flex-row gap-[0.5rem] justify-end items-center"}>
          <Button
            variant={"contained"}
            color="secondary"
            onClick={() => navigate(-1)}
          >
            Cancel
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
      </form>
    </Card>
  );
};

export default HandleBanners;
