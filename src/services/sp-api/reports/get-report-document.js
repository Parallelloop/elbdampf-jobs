const getReportDocument = async ({ client, reportDocumentId }) => {
  const response = await client.callAPI({
    operation: "getReportDocument",
    endpoint: "reports",
    path: {
      reportDocumentId,
    },
  });
  return response;
};

export default getReportDocument;
