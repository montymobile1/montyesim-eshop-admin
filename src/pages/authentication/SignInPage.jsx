import { yupResolver } from "@hookform/resolvers/yup";
import { LockOutlined, MailOutline } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import * as Yup from "yup";
import {
  FormInput,
  FormPassword,
} from "../../Components/form-component/FormComponent";
import supabase from "../../core/apis/supabase";
import { SignIn } from "../../Redux/reducers/AuthReducer";

const validationSchema = Yup.object({
  email: Yup.string().required("Email is required"),
  password: Yup.string().required("Password is required"),
});

export default function SignInPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();

  const { control, handleSubmit } = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    resolver: yupResolver(validationSchema),
    mode: "all",
  });

  const handleSubmitForm = async (payload) => {
    setLoading(true);

    await supabase.auth
      .signInWithPassword({
        email: payload.email?.trim(),
        password: payload.password?.trim(),
      })
      .then((res) => {
        if (res?.error) {
          toast.error(res?.error?.message || "Failed to Sign in");
          console.error("Error fetching data:", res?.error?.code);
        } else {
          dispatch(
            SignIn({
              access_token: res.data.session.access_token,
              refresh_token: res?.data?.session?.refresh_token,
              user_info: res.data.user,
            })
          );
          navigate("/users");
        }
      })
      .catch((e) => {
        toast.error(e?.message || "Failed to Sign in");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Box className="flex items-center justify-center min-h-[calc(100vh-180px)] px-4">
      <Card
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 420,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: `0 20px 45px -20px ${alpha(
            theme.palette.primary.main,
            0.25
          )}`,
        }}
      >
        <CardContent
          className="flex flex-col gap-6"
          sx={{ p: { xs: 3, sm: 5 }, "&:last-child": { pb: { xs: 3, sm: 5 } } }}
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <Box
              className="flex items-center justify-center w-14 h-14 rounded-2xl"
              sx={{
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
              }}
            >
              <LockOutlined fontSize="medium" />
            </Box>
            <div className="flex flex-col gap-1">
              <Typography variant="h5" component="h1" fontWeight={700}>
                Welcome back
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Sign in to continue to your dashboard
              </Typography>
            </div>
          </div>

          <form
            className="flex flex-col gap-5"
            onSubmit={handleSubmit(handleSubmitForm)}
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Typography
                component="label"
                htmlFor="email"
                variant="body2"
                fontWeight={600}
              >
                Email
              </Typography>
              <Controller
                render={({
                  field: { onChange, value },
                  fieldState: { error },
                }) => (
                  <FormInput
                    placeholder={"you@example.com"}
                    value={value}
                    helperText={error?.message}
                    onChange={(value) => onChange(value)}
                    startAdornment={
                      <MailOutline fontSize="small" sx={{ color: "text.secondary" }} />
                    }
                  />
                )}
                name="email"
                control={control}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Typography
                component="label"
                htmlFor="password"
                variant="body2"
                fontWeight={600}
              >
                Password
              </Typography>
              <Controller
                render={({
                  field: { onChange, value },
                  fieldState: { error },
                }) => (
                  <FormPassword
                    placeholder={"Enter your password"}
                    value={value}
                    helperText={error?.message}
                    onChange={(value) => onChange(value)}
                    startAdornment={
                      <LockOutlined fontSize="small" sx={{ color: "text.secondary" }} />
                    }
                  />
                )}
                name="password"
                control={control}
              />
            </div>
            <Button
              variant={"contained"}
              color="primary"
              type="submit"
              size="large"
              fullWidth
              disabled={loading}
              aria-label="Sign In"
              startIcon={
                loading ? <CircularProgress size={18} color="inherit" /> : null
              }
              sx={{
                mt: 1,
                py: 1.25,
                "&:hover": {
                  backgroundColor: theme.palette.primary.main,
                  boxShadow: `0 8px 20px -6px ${alpha(
                    theme.palette.primary.main,
                    0.5
                  )}`,
                  transform: "translateY(-1px)",
                },
                "&.Mui-disabled": {
                  backgroundColor: alpha(theme.palette.primary.main, 0.6),
                  color: theme.palette.primary.contrastText,
                },
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
