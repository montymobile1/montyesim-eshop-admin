import { yupResolver } from "@hookform/resolvers/yup";
import InfoIcon from "@mui/icons-material/Info";
import { Button, Card, LinearProgress, Tooltip } from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import * as yup from "yup";
import {
  FormDropdownList,
  FormInput,
  FormSingleImageUpload,
} from "../../Components/form-component/FormComponent";
import MuiModal from "../../Components/Modals/MuiModal";
import NoDataFound from "../../Components/shared/fallbacks/no-data-found/NoDataFound";
import FormsSkeletons from "../../Components/shared/skeletons/FormsSkeletons";

import {
  AddBanner,
  editBanner,
  getApiErrorCode,
  getBannerById,
} from "../../core/apis/bannersAPI";
import usePermission from "../../core/hooks/usePermission";
import { actionData, platformData } from "../../core/vairables/EnumData";
import { PERMISSIONS } from "../../core/vairables/Permissions";
import { MAX_UPLOAD_BYTES } from "../../core/vairables/Uploads";

let fileTypes = ["png", "jpg", "jpeg", "svg"];

// MS-5061: the API rejects images over 1 MB (413); check it in the browser first.
const MAX_BANNER_IMAGE_SIZE = MAX_UPLOAD_BYTES;

const schema =
  yup.object().shape({
    title: yup
      .string()
      .label("Title")
      .trim()
      .max(100)
      .min(2)
      .required("Title is required"),
    description: yup
      .string()
      .label("Description")
      .trim()
      .max(500)
      .min(2)
      .required("Description is required"),
    action: yup.object().nullable().label("Action"),
    // the app lists banners per platform, so a banner needs one
    platform: yup
      .object()
      .nullable()
      .label("Platform")
      .required("Platform is required"),
    // a File (new image) or, on edit, the current image URL
    image: yup
      .mixed()
      .nullable()
      .label("Image")
      .required("Image is required")
      .test(
        "fileSize",
        "Image must be 1 MB or smaller",
        (value) => !(value instanceof Blob) || value.size <= MAX_BANNER_IMAGE_SIZE,
      ),
  });


const HandleBanners = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const canWrite = usePermission(PERMISSIONS.BANNERS_WRITE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { isDirty },
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

  const {
    data,
    isLoading: loading,
    isError,
  } = useQuery({
    queryKey: ["banner", id],
    queryFn: () => getBannerById(id).then((res) => res?.data?.data),
    enabled: !!id,
    retry: false,
  });

  useEffect(() => {
    if (data) {
      reset({
        title: data?.title || "",
        description: data?.description || "",
        platform:
          platformData.find((plat) => plat.id === data?.platform) || null,
        action: actionData.find((act) => act.id === data?.action) || null,
        // a URL string: kept unless a new file is chosen
        image: data?.image_url || null,
      });
    }
  }, [data]);

  const handleSubmitForm = (payload) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setUploadProgress(0);
    let handleAPI = id ? editBanner : AddBanner;
    const onUploadProgress = (event) => {
      if (event?.total) {
        setUploadProgress(Math.round((event.loaded * 100) / event.total));
      }
    };

    // One multipart request: the API uploads the image and checks the title.
    handleAPI({
      ...payload,
      platform: payload?.platform?.id,
      action: payload?.action?.id,
      ...(id && { id: id }),
    }, onUploadProgress)
      .then(() => {
        toast.success(`Banner ${id ? "edited" : "added"} successfully`);
        queryClient.invalidateQueries({ queryKey: ["banners"] });
        queryClient.removeQueries({ queryKey: ["banner", id] });
        navigate(-1);
      })
      .catch((error) => {
        const status = error?.response?.status;
        if (getApiErrorCode(error) === "duplicate_title") {
          setError("title", { type: "server", message: "Name is not unique" });
        } else if (status === 413) {
          // fallback: the browser check normally stops this before the request. TEOS-191: the API's message
          // names the limit; a 413 without one (from a proxy) keeps the generic text
          setError("image", {
            type: "server",
            message: error?.response?.data?.message || "Image too large",
          });
        } else {
          toast.error(error?.message || "An error occured");
        }
      })
      .finally(() => {
        setIsSubmitting(false);
      });
  };

  // MS-5061: leaving with unsaved changes asks for confirmation.
  const onCancel = () => {
    if (isDirty) {
      setLeaveOpen(true);
    } else {
      navigate(-1);
    }
  };

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
  if (id && (isError || !data)) {
    return <NoDataFound text="Banner not found" />;
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
                    // Reset all fields when platform changes (kept dirty
                    // against the empty defaults for the leave check)
                    reset(
                      {
                        title: "",
                        description: "",
                        action: null,
                        platform: selected,
                        image: null,
                      },
                      { keepDefaultValues: true },
                    );
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
                  onChange={onChange}
                  minRows={2}
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
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant={"contained"}
            color="primary"
            disabled={isSubmitting || !canWrite}
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </Button>
        </div>
        {isSubmitting && (
          <div className={"flex flex-row gap-[0.5rem] justify-end items-center"}>
            <LinearProgress
              variant="determinate"
              value={uploadProgress}
              aria-label="save progress"
              className={"w-[200px]"}
            />
            <span className={"text-sm"}>{uploadProgress}%</span>
          </div>
        )}
      </form>
      {leaveOpen && (
        <MuiModal
          open={true}
          onClose={() => setLeaveOpen(false)}
          title={"Unsaved changes"}
          confirmButtonName={"Leave"}
          onConfirm={() => {
            setLeaveOpen(false);
            navigate(-1);
          }}
        >
          <p className={"text-center"}>
            You have unsaved changes. Leave without saving?
          </p>
        </MuiModal>
      )}
    </Card>
  );
};

export default HandleBanners;
