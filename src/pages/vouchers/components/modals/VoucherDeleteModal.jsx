import React from "react";
import MuiModal from "../../../../Components/Modals/MuiModal";

export default function VoucherDeleteModal({
  setOpenDelete,
  openDelete,
  handleDeleteVoucher,
  deleting = false,
}) {
  return (
    <MuiModal
      open={true}
      onClose={() => setOpenDelete({ data: null, open: false })}
      title={"Delete Voucher"}
      // ignore repeated clicks while the delete request runs
      onConfirm={() => !deleting && handleDeleteVoucher(openDelete?.data)}
    >
      <p className={"text-center"}>
        Are you sure you want to delete{" "}
        <span className={"font-bold"}>
          {openDelete?.data?.code ? `${openDelete?.data?.code}'s` : "this"}{" "}
        </span>{" "}
        voucher?
      </p>
    </MuiModal>
  );
}
