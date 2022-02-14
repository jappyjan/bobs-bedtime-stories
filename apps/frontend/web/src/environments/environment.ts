export const environment = {
  apiEndpoint: process.env["NX_API"] || 'http://localhost:1996',
  cdnEndpoint: process.env["NX_CDN"] || 'http://localhost:1709/cdn',
};
