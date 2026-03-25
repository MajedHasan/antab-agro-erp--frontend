import { formatCurrency } from "../utils/workOrderHelpers";

export default function WorkOrderTable({
  data,
  onView,
  onEdit,
  onStatusChange,
}) {
  return (
    <table className="erp-table">
      <thead>
        <tr>
          <th>No</th>
          <th>Supplier</th>
          <th>Status</th>
          <th>Total</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {data.map((wo: any) => (
          <tr key={wo._id}>
            <td>{wo.workOrderNo}</td>
            <td>{wo.supplier?.supplierName}</td>
            <td>{wo.status}</td>
            <td>{formatCurrency(wo.grandTotal)}</td>

            <td>
              <button onClick={() => onView(wo)}>View</button>
              <button onClick={() => onEdit(wo)}>Edit</button>
              <button onClick={() => onStatusChange(wo)}>Change Status</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
