import { Close } from "@mui/icons-material";
import { Dialog, DialogContent, IconButton, Skeleton } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { formatApiDate } from "../../../core/helpers/apiDates";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { getPromotionById } from "../../../core/apis/promotionsAPI";
import { beneficiaryData } from "../../../core/vairables/EnumData";
import {
  statusLabel,
  valueUnit,
} from "../../../pages/promotions/promotionHelpers";
import TagComponent from "../../shared/tag-component/TagComponent";

/*
  MS-5051 / MS-5053: the "View" dialog of a promotion, on GET /promotions/{id}.
*/
const PromotionDetail = ({ id, onClose }) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["promotions", "detail", id],
    queryFn: () => getPromotionById(id).then((res) => res?.data?.data),
    enabled: !!id,
  });

  useEffect(() => {
    if (isError) {
      toast.error(
        error?.response?.status === 404
          ? "Promotion not found"
          : error?.message || "Failed to load promotion"
      );
    }
  }, [isError]);

  const rule = data?.rule;
  const status = statusLabel(data?.status) || (data?.is_active ? "Active" : "Inactive");

  return (
    <Dialog open={true} maxWidth="sm" fullWidth>
      <DialogContent className="flex flex-col gap-[1rem] xs:!px-8 !py-10 justify-start">
        <div className={"flex flex-row justify-end"}>
          <IconButton
            aria-label="close"
            onClick={onClose}
            sx={() =>
              localStorage.getItem("i18nextLng") === "ar"
                ? {
                    position: "absolute",
                    left: 8,
                    top: 8,
                    color: "black",
                  }
                : {
                    position: "absolute",
                    right: 8,
                    top: 8,
                    color: "black",
                  }
            }
          >
            <Close />
          </IconButton>
        </div>
        <h1 className={"text-start"}>{"Promo Code Detail"}</h1>
        {isLoading ? (
          new Array(5).fill().map((_, index) => <Skeleton key={index} />)
        ) : isError ? (
          <p>Promotion not found</p>
        ) : (
          <div className={"flex flex-col gap-1"}>
            <div>
              <p className={"font-semibold"}>Name</p>
              <p>{data?.name}</p>
            </div>
            <div>
              <p className={"font-semibold"}>Code</p>
              <p>{data?.code}</p>
            </div>
            <div>
              <p className={"font-semibold"}>Rule</p>
              <p>
                {rule?.action?.name || "N/A"} | {rule?.event?.name || "N/A"} |{" "}
                {rule?.max_usage ?? "N/A"} |{" "}
                {beneficiaryData?.find((el) => el?.id === rule?.beneficiary)
                  ?.title || "N/A"}
              </p>
            </div>
            <div>
              <p className={"font-semibold"}>Amount</p>
              <p>
                {data?.amount ?? "N/A"} {data?.amount != null && valueUnit(rule)}
              </p>
            </div>
            <div>
              <p className={"font-semibold"}>Times Used</p>
              <p>{data?.times_used ?? 0}</p>
            </div>
            <div>
              <p className={"font-semibold"}>Duration</p>
              <p>
                From {formatApiDate(data?.valid_from)} To{" "}
                {formatApiDate(data?.valid_to)}
              </p>
            </div>
            <div>
              <p className={"font-semibold"}>Bundle Codes</p>
              <div
                className={"flex flex-col gap-1 max-h-[200px] overflow-auto"}
              >
                {data?.bundle_codes?.length
                  ? data.bundle_codes.map((el) => <div key={el}>{el}</div>)
                  : "All"}
              </div>
            </div>
            <div>
              <p className={"font-semibold"}>Status</p>
              <div>
                <TagComponent value={status} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PromotionDetail;
