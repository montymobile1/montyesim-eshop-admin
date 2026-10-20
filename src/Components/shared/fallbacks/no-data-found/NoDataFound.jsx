import clsx from "clsx";

const NoDataFound = (props) => {
  const { image, text, action, row } = props;
  return (
    <div
      className={clsx("flex items-center justify-center", {
        "flex-row gap-[0.5rem]": row,
        "flex-col gap-4": !row,
      })}
    >
      {image && <div>{image}</div>}
      <p className="text-content-400 align-center text-base text-center font-semibold">
        {text}
      </p>
      {action}
    </div>
  );
};

export default NoDataFound;
