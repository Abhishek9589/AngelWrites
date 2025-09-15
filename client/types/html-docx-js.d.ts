declare module "html-docx-js/dist/html-docx" {
  const HtmlDocx: {
    asBlob: (html: string, options?: any) => Blob;
  };
  export default HtmlDocx;
}
