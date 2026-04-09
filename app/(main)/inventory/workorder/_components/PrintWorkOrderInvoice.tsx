"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { buildTemplate } from "./templates";
import { buildHtmlDocument } from "../utils/buildHtmlDocument";
import { injectWatermark } from "../utils/injectWatermark";

export default function PrintWorkOrderInvoice({ viewing }: any) {
  const [printing, setPrinting] = useState(false);

  const handlePrint = useCallback(() => {
    if (!viewing) return;

    setPrinting(true);

    const iframe = document.createElement("iframe");
    iframe.style.display = "none";

    let selectedTemplateType;

    viewing.items.forEach((item: any) => {
      selectedTemplateType = item.itemType;
      console.log(item);

      if (item.itemType === "RawMaterial") {
        selectedTemplateType = "RawMaterial";
      } else if (item.itemType === "PackagingItem") {
        if (item.name.toLowerCase().includes("pouch")) {
          selectedTemplateType = "pouch";
        }
        if (item.name.toLowerCase().includes("carton")) {
          selectedTemplateType = "carton";
        }
        if (item.name.toLowerCase().includes("bottle")) {
          selectedTemplateType = "bottle";
        }
      } else if (item.itemType === "Product") {
        selectedTemplateType = "Product";
      } else if (item.itemType === "OtherProduct") {
        selectedTemplateType = "OtherProduct";
      }
    });

    console.log("Product Type: ", selectedTemplateType);

    const content = buildTemplate(
      { ...viewing, selectedTemplateId: selectedTemplateType },
      {
        name: "Antab Agro LTD",
      },
    );

    const html = buildHtmlDocument(content);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    iframe.onload = () => {
      const win = iframe.contentWindow;
      const doc = win?.document;

      if (!win || !doc) return;

      injectWatermark(
        doc,
        "Antab Agro LTD",
        window.location.origin + "/images/logo-green.png",
      );

      const img = doc.querySelector("img");

      const printNow = () => {
        win.focus();
        win.print();
        setPrinting(false);
      };

      if (img) {
        img.onload = printNow;
        img.onerror = printNow;
      } else {
        printNow();
      }
    };

    iframe.src = url;
    document.body.appendChild(iframe);
  }, [viewing]);

  return (
    <Button onClick={handlePrint} disabled={printing}>
      <Printer className="w-4 h-4 mr-2" />
      Print Invoice
    </Button>
  );
}
