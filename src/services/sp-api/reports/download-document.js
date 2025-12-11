const downloadDocument = async ({ client, reportData }) => {
  const response = await client.download(reportData);
  return response;
};

export default downloadDocument;
