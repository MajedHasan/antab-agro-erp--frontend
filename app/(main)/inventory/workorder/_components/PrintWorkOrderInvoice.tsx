"use client";

import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { buildPrintHtml, type WorkOrderView } from "./workOrderShared";

type Props = {
  viewing: WorkOrderView | null;
  label?: string;
  className?: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
};

export default function PrintWorkOrderInvoice({
  viewing,
  label = "Print",
  className,
  companyName = "Antag Agro",
  companyAddress = "Company address, city, country",
  companyPhone = "Phone: +000 000 000",
  companyEmail = "Email: info@company.com",
}: Props) {
  const handlePrint = useCallback(() => {
    if (!viewing) return;

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.left = "0";
    iframe.style.top = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";

    const html = buildPrintHtml(viewing, {
      name: companyName,
      address: companyAddress,
      phone: companyPhone,
      email: companyEmail,
    });

    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      if (iframe.parentNode) iframe.remove();
    };

    iframe.onload = () => {
      const win = iframe.contentWindow;
      if (!win) {
        cleanup();
        toast.error("Printing failed");
        return;
      }

      win.onafterprint = cleanup;

      setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          cleanup();
          toast.error("Printing failed");
        }
      }, 300);

      setTimeout(cleanup, 3000);
    };

    iframe.src = url;
    document.body.appendChild(iframe);
  }, [companyAddress, companyEmail, companyName, companyPhone, viewing]);

  return (
    <Button
      variant="outline"
      onClick={handlePrint}
      className={className}
      disabled={!viewing}
    >
      <Printer className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
