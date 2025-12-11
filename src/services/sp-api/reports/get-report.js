const getReport = async ({ client, reportId }) => {
  const response = await client.callAPI({
    operation: "getReport",
    endpoint: "reports",
    path: {
      reportId,
    },
  });
  const data = {
    status: response.processingStatus,
    reportDocumentId: response.reportDocumentId,
  };
  return data;
};

export default getReport;
