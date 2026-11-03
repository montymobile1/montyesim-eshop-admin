import { Card, Skeleton } from "@mui/material";

// Same layout as the group form (GroupsHandle): action buttons, the three main
// inputs, then tag cards with name, icon and search keyword (shown while
// GET /groups/{id} loads).
const InputSkeleton = ({ labelWidth = 80 }) => (
  <>
    <Skeleton variant="text" width={labelWidth} height={24} />
    <Skeleton
      variant="rounded"
      height={38}
      width="100%"
      sx={{ borderRadius: "16px" }}
    />
  </>
);

const SectionTitle = ({ title }) => (
  <div className="flex items-center">
    <div className="w-[20px] h-px bg-gray-300" />
    <h6 className="px-2">{title}</h6>
    <div className="w-[20px] h-px bg-gray-300" />
  </div>
);

const GroupsHandleSkeletons = ({ tagCount = 2 }) => {
  return (
    <Card data-testid="groups-handle-skeleton" aria-busy="true">
      <div className={"flex flex-col p-6 gap-[1rem]"}>
        <div className={"flex flex-row gap-[0.5rem] justify-end items-center"}>
          <Skeleton variant="rounded" width={80} height={36} />
          <Skeleton variant="rounded" width={80} height={36} />
        </div>
        <SectionTitle title="Main Info" />
        <div className={"flex flex-wrap gap-[1rem]"}>
          {[60, 50, 90].map((labelWidth, index) => (
            <div
              key={index} // NOSONAR
              className={"flex-1 min-w-[200px]"}
            >
              <InputSkeleton labelWidth={labelWidth} />
            </div>
          ))}
        </div>
        <SectionTitle title="Tags" />
        <div className="flex flex-col gap-3 w-full sm:w-[90%]">
          {new Array(tagCount).fill().map((_, index) => (
            <div
              key={index} // NOSONAR
              data-testid="groups-handle-skeleton-tag"
              className="relative flex flex-col gap-3 rounded-2xl border border-gray-200 p-4"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 min-w-0">
                  <InputSkeleton labelWidth={60} />
                </div>
                <div className="w-full sm:w-[240px] shrink-0">
                  <InputSkeleton labelWidth={40} />
                </div>
              </div>
              <div className="w-full">
                <InputSkeleton labelWidth={120} />
              </div>
            </div>
          ))}
          <Skeleton variant="rounded" width={110} height={36} />
        </div>
      </div>
    </Card>
  );
};

export default GroupsHandleSkeletons;
