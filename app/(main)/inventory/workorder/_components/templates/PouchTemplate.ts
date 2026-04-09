import { fmtMoney, words, fmtDate, safeName } from "../workOrderShared";

export function buildPouchTemplate(viewing: any, company: any) {
  const rows = (viewing.items || [])
    .map(
      (it: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${it.description || "-"}</td>
        <td class="right">${it.quantity}</td>
        <td class="right">${fmtMoney(it.unitPrice)}</td>
        <td class="right">${fmtMoney(it.lineTotal)}</td>
        <td class="right">${it.remarks}</td>
      </tr>
    `,
    )
    .join("");

  return `
    <h2>${company.name}</h2>

    <p>Work Order NO: ${viewing.workOrderNo}</p>
    <p>Ref: ${viewing.reference}</p>
    <p>Date: ${fmtDate(viewing.issueDate)}</p>

    <p>
      To<br/>
      Managing Director<br/>
      ${safeName(viewing.supplier)}
    </p>

    <p><strong>Subject:</strong> ${viewing.subject}</p>

    <p>
      Dear Sir / Madam,<br/>
      ${viewing?.salutation}:
    </p>

    <table>
      <thead>
        <tr>
          <th>SL</th>
          <th>Pack Size</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Total</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <p><strong>Total:</strong> ${fmtMoney(viewing.grandTotal)}</p>
    <p><strong>In Words:</strong> ${words(viewing.grandTotal || 0)}</p>

    <p><strong>Terms:</strong><br/>${viewing.terms || "-"}</p>

    <br/><br/>
    <p>Regards</p>
    <br/>
    <p><strong>Managing Director</strong></p>
  `;
}
