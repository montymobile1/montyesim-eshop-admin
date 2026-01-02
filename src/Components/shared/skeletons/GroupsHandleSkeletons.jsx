import { Card, CardContent, Skeleton } from "@mui/material";

const GroupsHandleSkeletons = () => {
  return (
    <Card>
      <CardContent className={"flex flex-col p-6 gap-[1rem]"}>
        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h5 className="bg-white px-2 text-gray-700">Main Info</h5>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>
        <div className={"flex flex-wrap gap-[1rem] "}>
          {new Array(3).fill().map((_, index) => (
            <Skeleton
              key={index} // NOSONAR
              variant="rectangular"
              height={50}
              width="100%"
              className={"flex-1"}
            />
          ))}
        </div>
        <div className="flex items-center">
          <div className="w-[20px] h-px bg-gray-300" />
          <h5 className="bg-white px-2 text-gray-700">Tags</h5>
          <div className="w-[20px] h-px bg-gray-300" />
        </div>
        <div className={"flex flex-wrap gap-[1rem] w-[70%]"}>
          {new Array(2).fill().map((_, index) => (
            <Skeleton
              key={index} // NOSONAR
              variant="rectangular"
              height={50}
              width="100%"
              className={"flex-1"}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupsHandleSkeletons;
