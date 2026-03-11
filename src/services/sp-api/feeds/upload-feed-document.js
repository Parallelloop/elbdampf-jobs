const uploadFeedDocument = async ({ client, feedDetails, feed }) => {
  const response = await client.upload(feedDetails, feed);
  return response;
};

export default uploadFeedDocument;
