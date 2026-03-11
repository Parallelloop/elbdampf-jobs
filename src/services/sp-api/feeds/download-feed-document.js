const downloadDocument = async ({ client, data }) => {
  const response = await client.download(data);
  return response;
};

export default downloadDocument;
