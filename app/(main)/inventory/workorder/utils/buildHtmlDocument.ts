export function buildHtmlDocument(content: string) {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Print</title>
      <style>
        @page { size: A4; margin: 12mm; }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          color: #000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #000;
          padding: 6px;
        }
        .right { text-align: right; }
      </style>
    </head>
    <body>
      ${content}
    </body>
  </html>
  `;
}
