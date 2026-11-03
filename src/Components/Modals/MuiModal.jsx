import {
  Backdrop,
  Box,
  Button,
  CircularProgress,
  Fade,
  Modal,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import React from "react";
import Loader from "../Loader/Loader";
const SIZE_MAP = {
  xs: 280,
  sm: 400,
  md: 550,
  lg: 700,
  xl: 900,
};

const MuiModal = ({
  open,
  onClose,
  onConfirm = () => {},
  title = "",
  children,
  size = "sm",
  buttonChildren = null,
  confirmButtonName = "Confirm",
  cancelButtonName = "Cancel",
  hideSubmit = false,
  displayButtons = true,
  loading = false,
  // TEOS-179: while the confirmed action runs, both buttons are disabled and
  // the confirm button shows a spinner and submittingButtonName.
  submitting = false,
  submittingButtonName,
}) => {
  const theme = useTheme();
  const width = SIZE_MAP[size] || SIZE_MAP.sm;
  if (loading) {
    return <Loader />;
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeAfterTransition
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 300,
      }}
      sx={{
        borderRadius: "16px",
      }}
    >
      <Fade in={open}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            bgcolor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            boxShadow: 24,
            borderRadius: "18px",
            minWidth: width,
            maxWidth: "95vw",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {loading ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "60vh",
              }}
            >
              <CircularProgress color="secondary" />
            </Box>
          ) : (
            <>
              {title && (
                <Box
                  sx={{
                    p: 3,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {typeof title === "string" ? (
                    <Typography variant="h6" fontWeight={600}>
                      {title}
                    </Typography>
                  ) : (
                    title
                  )}
                </Box>
              )}

              <Box
                sx={{
                  flexGrow: 1,
                  overflowY: "auto",
                  p: 3,
                  maxHeight: "60vh",
                }}
              >
                {children}
              </Box>

              {displayButtons && (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    gap: 2,
                    p: 3,
                    borderTop: `1px solid ${theme.palette.divider}`,
                  }}
                >
                  {buttonChildren || (
                    <>
                      <Button
                        variant="outlined"
                        onClick={onClose}
                        disabled={submitting}
                      >
                        {cancelButtonName}
                      </Button>
                      {!hideSubmit && (
                        <Button
                          variant="contained"
                          color="primary"
                          onClick={onConfirm}
                          disabled={submitting}
                          startIcon={
                            submitting ? (
                              <CircularProgress size={16} color="inherit" />
                            ) : null
                          }
                        >
                          {submitting
                            ? submittingButtonName || confirmButtonName
                            : confirmButtonName}
                        </Button>
                      )}
                    </>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>
      </Fade>
    </Modal>
  );
};

export default MuiModal;
