import { useCallback, useEffect, useState } from "react";
import getCroppedImg from "../../core/helpers/imageHelpers";
import Cropper from "react-easy-crop";
import { Box, Button, Stack, Typography } from "@mui/material";
import { ArrowLeft, Crop } from "@mui/icons-material";

export const ImageCropper = ({ imageSrc, setCroppedImage, onBack, aspect }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const onCropCompleteHandler = useCallback(
    (croppedArea, croppedAreaPixels) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  // Expose cropping to parent
  useEffect(() => {
    const generateCropped = async () => {
      if (!croppedAreaPixels) return;
      const croppedImage = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );
      console.log(croppedImage, "the cropped image");
      setCroppedImage(croppedImage);
    };
    generateCropped();
  }, [croppedAreaPixels, rotation, imageSrc, setCroppedImage]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Box
        sx={{ position: "relative", flex: 1, minHeight: 300, bgcolor: "#000" }}
      >
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspect || 1}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteHandler}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
        />
      </Box>

      <Box sx={{ p: 3, bgcolor: "#f5f5f5" }}>
        <Stack direction="row" spacing={2} justifyContent="space-between">
          <Button
            startIcon={<ArrowLeft size={16} />}
            onClick={onBack}
            color="inherit"
          >
            Back
          </Button>

          <Button
            onClick={() => {
              setZoom(1);
              setRotation(0);
              setCrop({ x: 0, y: 0 });
            }}
            color="inherit"
          >
            Reset
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};
