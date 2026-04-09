import { buildBottleTemplate } from "./BottleTemplate";
import { buildPouchTemplate } from "./PouchTemplate";
import { buildCartonTemplate } from "./CartonTemplate";
import { buildDefaultTemplate } from "./DefaultTemplate";

export function buildTemplate(viewing: any, company: any) {
  switch (viewing.selectedTemplateId) {
    case "bottle":
      return buildBottleTemplate(viewing, company);
    case "pouch":
      return buildPouchTemplate(viewing, company);
    case "carton":
      return buildCartonTemplate(viewing, company);
    case "RawMaterial":
      return buildCartonTemplate(viewing, company);
    case "Product":
      return buildCartonTemplate(viewing, company);
    case "OtherProduct":
      return buildCartonTemplate(viewing, company);
    default:
      return buildDefaultTemplate(viewing, company);
  }
}
