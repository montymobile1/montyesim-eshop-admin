import { Box, Card, Grid, Paper, Skeleton } from "@mui/material";
import GroupSectionSkeleton from "./GroupSectionSkeleton";

export default function AssignBundleToGroupsSkeleton() {
  return (
    <Card className="page-card">
      <Grid container spacing={3} sx={{ marginBottom: "32px" }}>
        <Grid item xs={12} md={6}>
          <Box sx={{ marginBottom: "8px" }}>
            <Skeleton variant="text" width={140} height={20} />
          </Box>
          <Paper
            elevation={0}
            sx={{
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "8px 16px",
              height: "56px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Skeleton variant="text" width="90%" height={24} />
          </Paper>
        </Grid>
        <Grid item xs={12} md={6} display={"flex"} justifyContent={"end"}>
          <Paper
            elevation={0}
            sx={{
              border: "1px solid #d1d5db",
              background: "#d1d5db",
              borderRadius: "25px",
              padding: "16px 16px",
              width: "20%",
              height: "40px",
              display: "flex",
              alignItems: "center",
              marginTop: 3,
            }}
          ></Paper>
        </Grid>
      </Grid>

      {Array.from({ length: 2 }, (_, i) => ({ id: i })).map((item) => (
        <GroupSectionSkeleton key={item?.id} />
      ))}
    </Card>
  );
}
