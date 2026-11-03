import { Delete, Upload } from "@mui/icons-material";
import { FormHelperText, IconButton, Slider } from "@mui/material";
import { useRef, useState } from "react";
import AvatarEditor from "react-avatar-editor";
import Dropzone from "react-dropzone";
import {
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  UPLOAD_IMAGE_TYPES,
} from "../../../core/vairables/Uploads";
import MuiModal from "../../Modals/MuiModal";

const sizeInKB = (bytes) => (bytes / 1024).toFixed(2);

const AvatarEditorComponent = ({ open, value, onClose, updateImage }) => {
  const [image, setImage] = useState(value);
  const [error, setError] = useState("");
  const [slideValue, setSlideValue] = useState(10);
  const cropRef = useRef(null);
  const handleDrop = (dropped) => {
    setImage(dropped[0]);
  };

  const handleSave = async () => {
    if (cropRef) {
      const dataUrl = cropRef?.current?.getImage().toDataURL();
      if (cropRef?.current) {
        const result = await fetch(dataUrl);
        const blob = await result.blob();
        // the cropped icon is re-encoded as PNG, which can be larger than the file dropped
        if (blob.size > MAX_UPLOAD_BYTES) {
          setError({
            message: `The cropped icon (${sizeInKB(blob.size)} KB) is larger than ${MAX_UPLOAD_LABEL}; zoom in or use a smaller image`,
          });
          return;
        }
        setImage(URL.createObjectURL(blob));
        updateImage(blob);
        onClose();
      } else {
        setImage(null);
        updateImage(null);
        onClose();
      }
    }
  };

  const handleRemove = () => {
    setImage(null);
  };
  return (
    <MuiModal
      title={"Tag Icon"}
      open={true}
      onClose={onClose}
      onConfirm={() => handleSave()}
    >
      {image ? (
        <div className={"flex flex-col justify-center items-center gap-[1rem]"}>
          <AvatarEditor
            ref={cropRef}
            image={image}
            style={{ width: "100%", height: "100%" }}
            border={50}
            borderRadius={150}
            color={[0, 0, 0, 0.72]}
            scale={slideValue / 10}
            rotate={0}
          />
          <div
            className={
              "flex flex-row gap-[0.5rem] justify-between w-full items-center"
            }
          >
            <Slider
              min={2}
              max={50}
              sx={{
                margin: "0 auto",
                width: "80%",
              }}
              size="medium"
              defaultValue={slideValue}
              value={slideValue}
              onChange={(e) => setSlideValue(e.target.value)}
            />
            <IconButton onClick={() => handleRemove()}>
              <Delete />
            </IconButton>
          </div>
        </div>
      ) : (
        <div className={"flex flex-col gap-[0.5rem]"}>
          {/* TEOS-190: the same types and size as the API (PNG, JPEG, WebP up to 1 MB) */}
          <Dropzone
            accept={UPLOAD_IMAGE_TYPES}
            maxSize={MAX_UPLOAD_BYTES}
            onDropRejected={(fileRejections) =>
              fileRejections.forEach(({ file, errors }) => {
                errors.forEach((e) => {
                  if (e.code === "file-too-large") {
                    setError({
                      ...e,
                      message: `File (${sizeInKB(file.size)} KB) is larger than ${MAX_UPLOAD_LABEL}`,
                    });
                  } else if (e.code === "file-invalid-type") {
                    setError({ ...e, message: "The icon must be a PNG, JPEG or WebP image" });
                  } else {
                    setError(e);
                  }
                });
              })
            }
            onDrop={(acceptedFiles) => {
              setError("");
              handleDrop(acceptedFiles);
            }}
          >
            {({ getRootProps, getInputProps }) => (
              <section className="wfp--dropzone w-full bg-(--color-primary-50) cursor-pointer border rounded-xl border-dashed border-gray-200 w-[200px] h-[200px] justify-center items-center">
                <div
                  {...getRootProps({
                    className:
                      "wfp--dropzone__input flex justify-center items-center h-[100%]",
                  })}
                >
                  <input {...getInputProps()} />
                  <div>
                    <Upload fontSize="small" /> drag and drop
                  </div>
                </div>
              </section>
            )}
          </Dropzone>
          {error && <FormHelperText>{error?.message}</FormHelperText>}
        </div>
      )}
    </MuiModal>
  );
};

export default AvatarEditorComponent;
