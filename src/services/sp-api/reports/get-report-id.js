const getReportId = async ({
  client,
  reportType,
  reportOptions = null,
  dataStartTime = null,
  dataEndTime = null,
}) => {
  const response = await client.callAPI({
    operation: "createReport",
    endpoint: "reports",
    body: {
      reportType,
      marketplaceIds: ["A1PA6795UKMFR9"],
      dataStartTime,
      dataEndTime,
    },
    reportOptions,
  });
  return response.reportId;
};

export default getReportId;
