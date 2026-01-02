import { Skeleton } from "@mui/material";

const TableSkeletons = ({ count }) => {
  return (
    <div className={"flex flex-col gap-[0.3rem]"}>
      {new Array(count).fill()?.map((_, index) => (
        <Skeleton
          key={index} // NOSONAR
        />
      ))}
    </div>
  );
};

export default TableSkeletons;
