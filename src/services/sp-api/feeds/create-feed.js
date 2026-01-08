const createFeed = async ({ client, feedType, feedDocumentId, marketplaceId }) => {
  const response = await client.callAPI({
    operation: "createFeed",
    endpoint: "feeds",
    body: {
      marketplaceIds: [marketplaceId],
      feedType,
      inputFeedDocumentId: feedDocumentId,
    },
  });
  return response;
};

export default createFeed;
