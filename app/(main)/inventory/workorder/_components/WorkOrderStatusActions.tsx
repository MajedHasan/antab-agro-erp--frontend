export default function WorkOrderStatusActions({
  workOrder,
  onApprove,
  onCancel,
  onProcessing,
}) {
  return (
    <div className="status-actions">
      {workOrder.status === "Pending" && (
        <button onClick={() => onProcessing(workOrder._id)}>
          Mark Processing
        </button>
      )}

      {workOrder.status === "Processing" && (
        <>
          <button onClick={() => onApprove(workOrder._id)}>Approve</button>

          <button
            onClick={() => {
              const reason = prompt("Cancel reason?");
              if (reason) onCancel(workOrder._id, reason);
            }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
