const getFeedDocument = async ({ client, feedDocumentId }) => {
  const response = await client.callAPI({
    operation: "getFeedDocument",
    endpoint: "feeds",
    path: {
      feedDocumentId,
    },
  });
  return response;
};

export default getFeedDocument;
