const createFeedDocument = async ({ client, contentType }) => {
  const response = await client.callAPI({
    operation: "createFeedDocument",
    endpoint: "feeds",
    body: {
      contentType,
    },
  });
  return response;
};

export default createFeedDocument;
