export function injectWatermark(
  doc: Document,
  companyName: string,
  logoUrl?: string,
) {
  const old = doc.getElementById("antab-watermark");
  old?.remove();

  const style = doc.createElement("style");
  style.textContent = `
    .antab-watermark {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
    }

    .antab-watermark__logo {
    //   max-width: 60%;
    width: 500px;
      opacity: 0.06;
    //   transform: rotate(-30deg);
    }

    .antab-watermark__text {
      font-size: 80px;
      font-weight: bold;
      opacity: 0.06;
    //   transform: rotate(-30deg);
    }
  `;
  doc.head.appendChild(style);

  const el = doc.createElement("div");
  el.id = "antab-watermark";
  el.className = "antab-watermark";

  if (logoUrl) {
    el.innerHTML = `<img src="${logoUrl}" class="antab-watermark__logo" />`;
  } else {
    el.innerHTML = `<div class="antab-watermark__text">${companyName}</div>`;
  }

  doc.body.appendChild(el);
}
